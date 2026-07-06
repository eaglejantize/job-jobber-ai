import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPI_URL = "https://api.vapi.ai/phone-number";

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
    const areaCode = String(body.area_code ?? "").trim();
    const clientId = String(body.client_id ?? "").trim();
    if (!/^\d{3}$/.test(areaCode)) return json({ error: "area_code must be 3 digits" }, 400);
    if (!clientId) return json({ error: "client_id required" }, 400);

    const { data: clientRow, error: clientErr } = await userClient
      .from("callcapture_clients")
      .select("id, user_id, business_name")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr || !clientRow || clientRow.user_id !== userId) {
      return json({ error: "Client not found" }, 404);
    }

    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    if (!VAPI_API_KEY) return json({ error: "Vapi not configured" }, 500);

    const vapiBody = {
      provider: "vapi",
      numberDesiredAreaCode: areaCode,
      name: clientRow.business_name?.slice(0, 40) || `Client ${clientId.slice(0, 8)}`,
    };

    const r = await fetch(VAPI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vapiBody),
    });
    const data = await r.json().catch(() => ({} as Record<string, unknown>));
    if (!r.ok) {
      console.error("Vapi number error", r.status, data);
      const msg = String(data?.message ?? data?.error ?? "").toLowerCase();
      const noInventory =
        r.status === 400 &&
        (msg.includes("area code") || msg.includes("no numbers") || msg.includes("not available") || msg.includes("unavailable"));
      if (noInventory) {
        return json(
          { error: "No numbers available in that area code. Please try a different one." },
          409,
        );
      }
      return json({ error: data?.message ?? "Vapi provisioning failed" }, 502);
    }

    const phoneNumber: string | undefined = typeof data.number === "string" ? data.number : undefined;
    const vapiId: string | undefined = typeof data.id === "string" ? data.id : undefined;
    if (!phoneNumber || !vapiId) {
      console.error("Vapi response missing fields", data);
      return json({ error: "Vapi did not return a number" }, 502);
    }

    const { error: updErr } = await userClient
      .from("callcapture_clients")
      .update({
        assigned_callcapture_number: phoneNumber,
        twilio_phone_number_sid: vapiId,
        number_status: "active",
        number_provisioned_at: new Date().toISOString(),
        phone_mode: "new",
      })
      .eq("id", clientId);
    if (updErr) {
      console.error("DB update error", updErr);
      return json({ error: "Number provisioned but failed to save. Contact support.", id: vapiId }, 500);
    }

    return json({
      phone_number: phoneNumber,
      id: vapiId,
      status: "active",
      message: "Your Vektuor number is active.",
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