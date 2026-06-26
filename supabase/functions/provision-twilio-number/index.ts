import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const VAPI_URL = "https://api.vapi.ai";

function buildSystemPrompt(c: Record<string, any>): string {
  const businessName = c.business_name ?? "the business";
  const industry = c.industry ?? "service business";
  const tone = c.tone ?? "Friendly";
  const questions = (c.intake_questions ?? []) as string[];
  const services = (c.services ?? []) as string[];
  const lines: string[] = [];
  lines.push(`You are a professional AI receptionist for ${c.include_business_name === false ? "a " + industry + " business" : businessName}.`);
  lines.push(`Industry: ${industry}. Tone: ${tone}. Speak naturally, warmly, and concisely.`);
  lines.push("");
  lines.push("Answer the call, capture lead information, and let the caller know someone will follow up shortly.");
  if (services.length) lines.push(`Services offered: ${services.join(", ")}.`);
  if (questions.length) {
    lines.push("");
    lines.push("Ask the caller these questions, one at a time, in a natural conversational way:");
    questions.forEach((q: string, i: number) => lines.push(`${i + 1}. ${q}`));
  }
  lines.push("");
  lines.push("Never invent pricing, availability, or promises. If unsure, say the team will follow up.");
  return lines.join("\n");
}
function buildGreeting(c: Record<string, any>): string {
  if (c.greeting) return c.greeting;
  const name = c.business_name ?? "our office";
  if (c.industry === "med_spa") return `Thank you for calling ${name}, your personal concierge is here. How may I assist you today?`;
  return `Thanks for calling ${name}. How can I help you today?`;
}
async function vapiFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${VAPI_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}
async function upsertAssistant(client: Record<string, any>, apiKey: string, webhookUrl: string, webhookSecret?: string) {
  const payload = {
    name: `Vektuor — ${client.business_name ?? "Tenant"}`.slice(0, 40),
    firstMessage: buildGreeting(client),
    model: { provider: "openai", model: "gpt-4o-mini", messages: [{ role: "system", content: buildSystemPrompt(client) }] },
    voice: client.voice_id ? { provider: "11labs", voiceId: client.voice_id } : { provider: "vapi", voiceId: "Elliot" },
    server: { url: webhookUrl, ...(webhookSecret ? { secret: webhookSecret } : {}) },
    serverMessages: ["status-update", "transcript", "end-of-call-report", "conversation-update", "tool-calls"],
    metadata: { client_id: client.id, user_id: client.user_id },
  };
  if (client.vapi_assistant_id) {
    const upd = await vapiFetch(apiKey, `/assistant/${client.vapi_assistant_id}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (upd.ok && upd.body?.id) return { id: upd.body.id as string, error: null as string | null };
  }
  const created = await vapiFetch(apiKey, `/assistant`, { method: "POST", body: JSON.stringify(payload) });
  if (!created.ok || !created.body?.id) return { id: "", error: `assistant create failed (${created.status}): ${JSON.stringify(created.body)}` };
  return { id: created.body.id as string, error: null };
}

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

    // Verify caller owns the client (use service role to bypass RLS for full row)
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: clientRow, error: clientErr } = await userClient
      .from("callcapture_clients")
      .select("id, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr || !clientRow || clientRow.user_id !== userId) {
      return json({ error_code: "not_found", error: "Client not found" }, 404);
    }
    const { data: fullClient } = await admin.from("callcapture_clients").select("*").eq("id", clientId).maybeSingle();
    if (!fullClient) return json({ error_code: "not_found", error: "Client not found" }, 404);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const WEBHOOK_SECRET = Deno.env.get("VAPI_WEBHOOK_SECRET") ?? "";
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vapi-webhook`;
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
      FriendlyName: ((fullClient as any).business_name ?? "Vektuor").slice(0, 64),
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

    // 2) Create/update a PER-TENANT Vapi assistant with webhook configured.
    let assistantId: string | null = null;
    let assistantError: string | null = null;
    if (VAPI_API_KEY) {
      const a = await upsertAssistant(fullClient as any, VAPI_API_KEY, webhookUrl, WEBHOOK_SECRET || undefined);
      assistantId = a.id || null;
      assistantError = a.error;
      if (assistantError) console.error("assistant upsert error", assistantError);
    }

    // 3) Register the Twilio number with Vapi (BYO Twilio) so Vapi answers inbound calls.
    let vapiPhoneNumberId: string | null = null;
    let routing_status: "active" | "needs_configuration" = "needs_configuration";
    let routing_error: string | null = null;
    if (VAPI_API_KEY && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && assistantId) {
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
            name: ((fullClient as any).business_name ?? "Vektuor").slice(0, 40),
            assistantId,
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
      routing_error = assistantError ?? "Missing VAPI/TWILIO secrets or assistant creation failed — call routing not connected.";
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
    const { error: updErr } = await admin
      .from("callcapture_clients")
      .update({
        assigned_callcapture_number: phoneNumber,
        twilio_phone_number_sid: sid,
        vapi_phone_number_id: vapiPhoneNumberId,
        vapi_assistant_id: assistantId,
        number_status: routing_status,
        webhook_status: routing_status === "active" ? "configured" : "pending",
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
      assistant_id: assistantId,
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