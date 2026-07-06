import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapiKey = Deno.env.get("VAPI_API_KEY");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: me } = await admin
      .from("callcapture_clients")
      .select("is_super_admin")
      .eq("user_id", userId)
      .maybeSingle();
    if (!me?.is_super_admin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String((body as { action?: string }).action ?? "list");

    if (action === "list") {
      const { data, error } = await (admin.from("callcapture_voice_catalog") as {
        select: (columns: string) => { order: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
      })
        .select("id, customer_category, label, persona, provider, provider_voice_id, provider_preview_url, local_preview_url, preview_source, verified_active, is_active, sort_order, updated_at")
        .order("sort_order", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ voices: data ?? [] });
    }

    if (!vapiKey) return json({ error: "VAPI_API_KEY is not configured" }, 500);

    const voiceCatalogId = String((body as { voice_catalog_id?: string }).voice_catalog_id ?? "").trim();
    if (!voiceCatalogId) return json({ error: "voice_catalog_id required" }, 400);

    const { data: row, error: rowErr } = await (admin.from("callcapture_voice_catalog") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: { id: string; provider_voice_id: string } | null; error: { message: string } | null }>;
        };
      };
    })
      .select("id, provider_voice_id")
      .eq("id", voiceCatalogId)
      .maybeSingle();

    if (rowErr || !row) return json({ error: rowErr?.message ?? "Voice catalog row not found" }, 404);

    const listResp = await fetch("https://api.vapi.ai/voice", {
      headers: { Authorization: `Bearer ${vapiKey}` },
    });
    const listRaw = await listResp.json().catch(() => ({}));
    if (!listResp.ok) return json({ error: `Provider lookup failed: ${listResp.status}` }, 502);

    const list = Array.isArray(listRaw) ? listRaw : ((listRaw as { voices?: unknown[]; data?: unknown[] }).voices ?? (listRaw as { data?: unknown[] }).data ?? []);
    const matched = list.find((v) => {
      const voice = v as { id?: string; voiceId?: string; voice_id?: string };
      const id = String(voice.id ?? voice.voiceId ?? voice.voice_id ?? "");
      return id === row.provider_voice_id;
    }) as { previewUrl?: string; preview_url?: string } | undefined;

    const verified = !!matched;
    const preview = matched ? String(matched.previewUrl ?? matched.preview_url ?? "") || null : null;

    const { error: updErr } = await (admin.from("callcapture_voice_catalog") as {
      update: (payload: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
      };
    })
      .update({ verified_active: verified, provider_preview_url: preview, updated_at: new Date().toISOString() })
      .eq("id", voiceCatalogId);

    if (updErr) return json({ error: updErr.message }, 500);

    return json({ verified_active: verified, provider_preview_url: preview });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
