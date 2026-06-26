import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (input.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
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
    const mode = String(body.mode ?? "").trim() as "byo" | "forward" | "test";
    const clientId = String(body.client_id ?? "").trim();
    if (!clientId) return json({ error_code: "bad_request", error: "client_id required" }, 400);
    if (!["byo", "forward", "test"].includes(mode)) {
      return json({ error_code: "bad_request", error: "mode must be byo|forward|test" }, 400);
    }

    const { data: clientRow } = await userClient
      .from("callcapture_clients")
      .select("id, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!clientRow || clientRow.user_id !== userId) {
      return json({ error_code: "not_found", error: "Client not found" }, 404);
    }

    const now = new Date().toISOString();

    if (mode === "test") {
      const demo = Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("DEMO_OWNER_PHONE");
      if (!demo) {
        return json(
          { error_code: "missing_secret", error: "No demo number configured" },
          500,
        );
      }
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: updErr } = await userClient
        .from("callcapture_clients")
        .update({
          assigned_callcapture_number: demo,
          number_status: "test",
          phone_mode: "test",
          number_provisioned_at: now,
          number_test_expires_at: expires,
        })
        .eq("id", clientId);
      if (updErr) return json({ error_code: "db_error", error: updErr.message }, 500);
      return json({
        phone_number: demo,
        status: "test",
        message: "Temporary test number assigned for 7 days.",
        expires_at: expires,
      });
    }

    const phone = normalizeE164(String(body.phone_number ?? ""));
    if (!phone) {
      return json({ error_code: "bad_request", error: "Valid phone_number required" }, 400);
    }

    const patch: Record<string, unknown> = {
      assigned_callcapture_number: phone,
      number_status: mode === "forward" ? "pending_forwarding" : "pending_forwarding",
      phone_mode: mode,
      number_provisioned_at: now,
    };
    if (mode === "forward") patch.forwarding_from_number = phone;

    const { error: updErr } = await userClient
      .from("callcapture_clients")
      .update(patch)
      .eq("id", clientId);
    if (updErr) return json({ error_code: "db_error", error: updErr.message }, 500);

    return json({
      phone_number: phone,
      status: "pending_forwarding",
      message:
        mode === "forward"
          ? "Number saved. Configure call forwarding with your carrier to your Vektuor number."
          : "Number saved. Connect inbound calls to your Vektuor flow when ready.",
    });
  } catch (e) {
    console.error(e);
    return json({ error_code: "exception", error: (e as Error).message }, 500);
  }
});