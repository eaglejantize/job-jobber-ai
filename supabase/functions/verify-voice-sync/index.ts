import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveVoiceForClient } from "../_shared/voice-resolution.ts";
import { logVoiceSync } from "../_shared/voice-sync-log.ts";

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
    if (!vapiKey) return json({ error: "VAPI_API_KEY is not configured" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const clientId = String((body as { client_id?: string }).client_id ?? "").trim();
    if (!clientId) return json({ error: "client_id required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: client } = await admin.from("callcapture_clients").select("*").eq("id", clientId).maybeSingle();
    if (!client) return json({ error: "Client not found" }, 404);

    let allowed = client.user_id === userId;
    if (!allowed) {
      const { data: me } = await admin
        .from("callcapture_clients")
        .select("is_super_admin")
        .eq("user_id", userId)
        .maybeSingle();
      allowed = !!me?.is_super_admin;
    }
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const resolved = await resolveVoiceForClient(admin, client as Record<string, unknown>);
    const assistantId = String(client.vapi_assistant_id ?? "").trim();
    if (!assistantId) {
      const message = "No assistant configured for tenant";
      await admin.from("callcapture_clients").update({
        voice_sync_status: "failed",
        voice_last_sync_at: new Date().toISOString(),
        voice_last_sync_error: message,
      }).eq("id", clientId);
      await logVoiceSync(admin, {
        clientId,
        voiceCatalogId: resolved.selectedVoiceCatalogId,
        action: "verify-voice-sync",
        status: "failed",
        voiceProvider: resolved.provider,
        providerVoiceId: resolved.providerVoiceId,
        errorMessage: message,
      });
      return json({ status: "failed", error: message }, 200);
    }

    const resp = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      headers: { Authorization: `Bearer ${vapiKey}` },
    });
    const raw = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const message = `Assistant lookup failed: ${resp.status}`;
      await admin.from("callcapture_clients").update({
        voice_sync_status: "failed",
        voice_last_sync_at: new Date().toISOString(),
        voice_last_sync_error: message,
      }).eq("id", clientId);
      await logVoiceSync(admin, {
        clientId,
        voiceCatalogId: resolved.selectedVoiceCatalogId,
        action: "verify-voice-sync",
        status: "failed",
        voiceProvider: resolved.provider,
        providerVoiceId: resolved.providerVoiceId,
        providerAgentId: assistantId,
        errorMessage: message,
      });
      return json({ status: "failed", error: message }, 200);
    }

    const assistantVoice = ((raw as { voice?: { provider?: string; voiceId?: string } }).voice ?? {}) as {
      provider?: string;
      voiceId?: string;
    };
    const liveProvider = String(assistantVoice.provider ?? "");
    const liveVoiceId = String(assistantVoice.voiceId ?? "");

    const mismatchReason = resolved.mismatch
      ? resolved.mismatchReason
      : liveProvider !== resolved.provider || liveVoiceId !== resolved.providerVoiceId
      ? `Live assistant voice (${liveProvider}:${liveVoiceId}) differs from selected voice (${resolved.provider}:${resolved.providerVoiceId})`
      : null;

    const syncStatus = mismatchReason ? "failed" : "synced";

    await admin.from("callcapture_clients").update({
      voice_provider: resolved.provider,
      voice_provider_voice_id: resolved.providerVoiceId,
      voice_provider_agent_id: assistantId,
      voice_sync_status: syncStatus,
      voice_last_sync_at: new Date().toISOString(),
      voice_last_sync_error: mismatchReason,
      voice_phone_number_snapshot: client.assigned_callcapture_number ?? client.business_phone ?? null,
    }).eq("id", clientId);

    await logVoiceSync(admin, {
      clientId,
      voiceCatalogId: resolved.selectedVoiceCatalogId,
      action: "verify-voice-sync",
      status: syncStatus,
      voiceProvider: resolved.provider,
      providerVoiceId: resolved.providerVoiceId,
      providerAgentId: assistantId,
      phoneNumberSnapshot: client.assigned_callcapture_number ?? client.business_phone ?? null,
      errorMessage: mismatchReason,
      detail: { live_provider: liveProvider, live_voice_id: liveVoiceId },
    });

    return json({
      status: syncStatus,
      error: mismatchReason,
      expected: { provider: resolved.provider, voice_id: resolved.providerVoiceId },
      live: { provider: liveProvider, voice_id: liveVoiceId },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
