import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const VAPI_URL = "https://api.vapi.ai";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const phoneNumber = String(body.phone_number ?? "").trim();
    const clientId = String(body.client_id ?? "").trim();
    if (!/^\+\d{6,15}$/.test(phoneNumber)) {
      return json({ error_code: "bad_request", error: "phone_number must be E.164 format" }, 400);
    }
    if (!clientId) return json({ error_code: "bad_request", error: "client_id required" }, 400);

    // Verify caller owns the client
    const { data: clientRow, error: clientErr } = await userClient
      .from("callcapture_clients")
      .select("id, user_id, business_name")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr || !clientRow || clientRow.user_id !== userId) {
      return json({ error_code: "not_found", error: "Client not found" }, 404);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return json({ error_code: "missing_secret", error: "Twilio not configured" }, 500);
    }

    const twilioHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // 1) Purchase number via Twilio connector gateway
    const purchaseBody = new URLSearchParams({
      PhoneNumber: phoneNumber,
      FriendlyName: (clientRow.business_name ?? "Vektuor").slice(0, 64),
    });
    const r = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
      method: "POST",
      headers: twilioHeaders,
      body: purchaseBody,
    });
    const data = await r.json().catch(() => ({} as any));
    if (!r.ok) {
      console.error("Twilio purchase error", r.status, data);
      const code =
        r.status === 401 || r.status === 403 ? "twilio_auth_failed" : "purchase_failed";
      return json({ error_code: code, error: data?.message ?? "Purchase failed", status: r.status }, 502);
    }

    const sid: string = data.sid;

    // 2) Look up an existing Vapi assistant for this client (by previous Vapi number) so we can route to it.
    let assistantId: string | null = null;
    if (VAPI_API_KEY) {
      try {
        const aRes = await fetch(`${VAPI_URL}/assistant?limit=100`, {
          headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
        });
        if (aRes.ok) {
          const list = (await aRes.json()) as Array<{ id: string; name?: string }>;
          // Best-effort: match by business name
          const match = list.find((x) =>
            (x.name ?? "").toLowerCase().includes((clientRow.business_name ?? "").toLowerCase()),
          );
          assistantId = match?.id ?? list[0]?.id ?? null;
        }
      } catch (e) {
        console.warn("Vapi assistant lookup failed", e);
      }
    }

    // 3) Register the Twilio number with Vapi (BYO Twilio) so Vapi answers inbound calls.
    let vapiPhoneNumberId: string | null = null;
    let routing_status: "active" | "needs_configuration" = "needs_configuration";
    let routing_error: string | null = null;
    if (VAPI_API_KEY && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      try {
        const reg = await fetch(`${VAPI_URL}/phone-number`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "twilio",
            number: phoneNumber,
            twilioAccountSid: TWILIO_ACCOUNT_SID,
            twilioAuthToken: TWILIO_AUTH_TOKEN,
            name: (clientRow.business_name ?? "Vektuor").slice(0, 40),
            assistantId: assistantId ?? undefined,
          }),
        });
        const regData = await reg.json().catch(() => ({} as any));
        if (reg.ok && regData?.id) {
          vapiPhoneNumberId = regData.id;
          routing_status = "active";
        } else {
          console.error("Vapi register error", reg.status, regData);
          routing_error = `Vapi register failed (${reg.status}): ${regData?.message ?? "unknown"}`;
        }
      } catch (e) {
        routing_error = (e as Error).message;
      }
    } else {
      routing_error = "Missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN or VAPI_API_KEY — call routing not connected.";
    }

    // 4) If Vapi didn't register, set Twilio Voice URL to Vapi's TwiML inbound endpoint as a fallback so calls don't dead-air.
    if (routing_status !== "active") {
      try {
        const voiceUrl = "https://api.vapi.ai/twilio/inbound_call";
        const smsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vapi-webhook?kind=sms`;
        const upd = new URLSearchParams({
          VoiceUrl: voiceUrl,
          VoiceMethod: "POST",
          SmsUrl: smsUrl,
          SmsMethod: "POST",
        });
        const wRes = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers/${sid}.json`, {
          method: "POST",
          headers: twilioHeaders,
          body: upd,
        });
        if (!wRes.ok) {
          const wText = await wRes.text();
          console.error("Twilio webhook update error", wRes.status, wText);
        }
      } catch (e) {
        console.warn("Webhook update failed (non-fatal)", e);
      }
    }

    // 5) Persist
    const { error: updErr } = await userClient
      .from("callcapture_clients")
      .update({
        assigned_callcapture_number: phoneNumber,
        twilio_phone_number_sid: sid,
        vapi_phone_number_id: vapiPhoneNumberId,
        number_status: routing_status,
        number_provisioned_at: new Date().toISOString(),
        phone_mode: "new",
      })
      .eq("id", clientId);
    if (updErr) {
      console.error("DB update error", updErr);
      return json(
        { error_code: "db_error", error: "Number purchased but failed to save. Contact support.", sid },
        500,
      );
    }

    return json({
      phone_number: phoneNumber,
      sid,
      id: vapiPhoneNumberId,
      status: routing_status,
      routing_error,
      message:
        routing_status === "active"
          ? "Your Vektuor number is live."
          : `Number purchased. Routing pending: ${routing_error ?? "configuration in progress"}`,
    });
  } catch (e) {
    console.error(e);
    return json({ error_code: "exception", error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}