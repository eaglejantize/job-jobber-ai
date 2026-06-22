import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("VAPI_WEBHOOK_SECRET") ?? "";

type Json = Record<string, unknown>;

function getStr(o: Json | undefined, ...keys: string[]): string | null {
  if (!o) return null;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Optional shared-secret check (Vapi sends x-vapi-secret header)
  if (WEBHOOK_SECRET) {
    const provided = req.headers.get("x-vapi-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (provided !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: Json = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const msg = (body.message ?? body) as Json;
  const type = getStr(msg, "type") ?? "";
  const callObj = (msg.call as Json | undefined) ?? {};
  const vapiCallId = getStr(callObj, "id") ?? getStr(msg, "callId") ?? "";
  const customer = (callObj.customer as Json | undefined) ?? (msg.customer as Json | undefined) ?? {};
  const callerPhone = getStr(customer, "number", "phoneNumber") ?? null;
  const callerName = getStr(customer, "name") ?? null;

  if (!vapiCallId) {
    return new Response(JSON.stringify({ ok: true, ignored: "no call id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve client_id from assistantId → assistant_configs → user_id → client
  const assistantId = getStr(callObj, "assistantId") ?? getStr(msg, "assistantId");
  let clientId: string | null = null;
  let businessId: string | null = null;
  if (assistantId) {
    const { data: cfg } = await supabase
      .from("callcapture_assistant_configs")
      .select("user_id, business_id")
      .eq("id", assistantId).maybeSingle();
    businessId = cfg?.business_id ?? null;
    if (cfg?.user_id) {
      const { data: cli } = await supabase.from("callcapture_clients")
        .select("id").eq("user_id", cfg.user_id).maybeSingle();
      clientId = cli?.id ?? null;
    }
  }

  // Find or create the call row
  const { data: existing } = await supabase
    .from("callcapture_calls")
    .select("id, client_id")
    .eq("vapi_call_id", vapiCallId).maybeSingle();

  let callId = existing?.id ?? null;
  if (!callId) {
    const { data: ins } = await supabase.from("callcapture_calls").insert({
      vapi_call_id: vapiCallId,
      client_id: clientId,
      business_id: businessId,
      caller_name: callerName,
      caller_phone: callerPhone,
      status: "live",
    }).select("id").single();
    callId = ins?.id ?? null;
  }
  if (!callId) {
    return new Response(JSON.stringify({ error: "could not create call" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle event types
  if (type === "status-update") {
    const status = getStr(msg, "status");
    if (status === "in-progress") await supabase.from("callcapture_calls").update({ status: "live" }).eq("id", callId);
  } else if (type === "transcript" || type === "conversation-update") {
    const role = getStr(msg, "role");
    const text = getStr(msg, "transcript", "text");
    if (text && (role === "user" || role === "assistant")) {
      const { count } = await supabase.from("callcapture_transcript_turns")
        .select("*", { count: "exact", head: true }).eq("call_id", callId);
      await supabase.from("callcapture_transcript_turns").insert({
        call_id: callId,
        role: role === "assistant" ? "ai" : "caller",
        text,
        seq: (count ?? 0) + 1,
      });
    }
  } else if (type === "transfer-destination-request") {
    await supabase.from("callcapture_calls").update({ status: "transferred" }).eq("id", callId);
  } else if (type === "end-of-call-report") {
    const summary = getStr(msg, "summary") ?? getStr(callObj, "summary");
    const recording = getStr(msg, "recordingUrl") ?? getStr(callObj, "recordingUrl");
    const startedAt = getStr(callObj, "startedAt", "createdAt");
    const endedAt = getStr(callObj, "endedAt") ?? new Date().toISOString();
    const duration = startedAt
      ? Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
      : null;
    await supabase.from("callcapture_calls").update({
      status: "completed",
      ended_at: endedAt,
      duration_seconds: duration,
      recording_url: recording,
      issue_summary: summary,
    }).eq("id", callId);
  }

  return new Response(JSON.stringify({ ok: true, call_id: callId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});