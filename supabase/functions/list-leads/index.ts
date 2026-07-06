import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Returns leads for the current authenticated user using the service role
// (bypasses RLS). Resolves the user's client row by user_id then email,
// returns owned + unlinked leads (and, as a temporary debug fallback, all
// recent leads) so the inbox can verify writes regardless of client_id.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });

    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "invalid auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let clientId: string | null = null;
    const { data: byUser } = await admin
      .from("callcapture_clients")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    clientId = byUser?.id ?? null;
    if (!clientId && user.email) {
      const { data: byEmail } = await admin
        .from("callcapture_clients")
        .select("id")
        .ilike("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      clientId = byEmail?.id ?? null;
    }

    const cols = "id, client_id, name, phone, address, type, treatment, issue, summary, urgency, transcript, intake_answers, status, created_at";

    const queries: Promise<{ data: Array<{ id: string; created_at: string } & Record<string, unknown>> | null; error: Error | null }>[] = [
      admin.from("callcapture_leads").select(cols).is("client_id", null).order("created_at", { ascending: false }).limit(200),
      // Debug fallback: most recent leads regardless of client_id.
      admin.from("callcapture_leads").select(cols).order("created_at", { ascending: false }).limit(200),
    ];
    if (clientId) {
      queries.unshift(admin.from("callcapture_leads").select(cols).eq("client_id", clientId).order("created_at", { ascending: false }).limit(200));
    }

    const results = await Promise.all(queries);
    const map = new Map<string, { id: string; created_at: string } & Record<string, unknown>>();
    for (const r of results) {
      for (const row of r.data ?? []) {
        if (!map.has(row.id)) map.set(row.id, row);
      }
    }
    const leads = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return new Response(JSON.stringify({ client_id: clientId, leads }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});