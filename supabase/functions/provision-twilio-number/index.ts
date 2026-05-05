import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

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
      return json({ error: "phone_number must be E.164 format" }, 400);
    }
    if (!clientId) return json({ error: "client_id required" }, 400);

    // Verify caller owns the client
    const { data: clientRow, error: clientErr } = await userClient
      .from("callcapture_clients")
      .select("id, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr || !clientRow || clientRow.user_id !== userId) {
      return json({ error: "Client not found" }, 404);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return json({ error: "Twilio not configured" }, 500);
    }

    // Purchase number (no webhooks wired yet → mark needs_configuration)
    const purchaseBody = new URLSearchParams({ PhoneNumber: phoneNumber });
    const r = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: purchaseBody,
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Twilio purchase error", r.status, data);
      return json({ error: data?.message ?? "Purchase failed" }, 502);
    }

    const sid = data.sid;
    const status = "needs_configuration";

    // Persist with service role to bypass any field-level constraints (RLS still allows owner update, but use anon client tied to user)
    const { error: updErr } = await userClient
      .from("callcapture_clients")
      .update({
        assigned_callcapture_number: phoneNumber,
        twilio_phone_number_sid: sid,
        number_status: status,
        number_provisioned_at: new Date().toISOString(),
        phone_mode: "new",
      })
      .eq("id", clientId);
    if (updErr) {
      console.error("DB update error", updErr);
      return json({ error: "Number purchased but failed to save. Contact support.", sid }, 500);
    }

    return json({
      phone_number: phoneNumber,
      sid,
      status,
      message: "Number reserved. Final call routing is being configured.",
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}