import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SERVANAHQ_BASE_URL = (Deno.env.get("SERVANAHQ_BASE_URL") ?? "").replace(/\/+$/, "");
const SERVANAHQ_API_KEY = Deno.env.get("SERVANAHQ_API_KEY") ?? "";
const SERVANAHQ_ANON_KEY = Deno.env.get("SERVANAHQ_ANON_KEY") ?? "";

type Json = Record<string, unknown>;

function parseTiming(raw: string | null | undefined): { day: string | null; time: string | null } {
  if (!raw) return { day: null, time: null };
  const s = String(raw);
  const dayMatch = s.match(/\b(today|tomorrow|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|\d{1,2}\/\d{1,2}(\/\d{2,4})?)\b/i);
  const timeMatch = s.match(/\b(\d{1,2}(:\d{2})?\s?(am|pm)|morning|afternoon|evening|asap|anytime)\b/i);
  return { day: dayMatch?.[0] ?? null, time: timeMatch?.[0] ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let payload: { client_id?: string; lead_id?: string; vapi_call_id?: string | null } = {};
  try { payload = await req.json(); } catch { /* noop */ }
  const { client_id, lead_id, vapi_call_id = null } = payload;

  const log = async (step: string, status: "ok" | "error" | "skipped", detail?: unknown) => {
    try {
      await supabase.from("callcapture_webhook_events").insert({
        client_id: client_id ?? null,
        vapi_call_id: vapi_call_id ?? null,
        step,
        status,
        detail: (detail ?? null) as any,
      });
    } catch (e) {
      console.error("[sync-servanahq] diag insert failed", e);
    }
  };

  const updateLead = async (patch: Json) => {
    if (!lead_id) return;
    await supabase.from("callcapture_leads").update(patch as any).eq("id", lead_id);
  };

  if (!client_id || !lead_id) {
    await log("servanahq_check", "error", { reason: "missing_ids" });
    return respond({ ok: false, reason: "missing_ids" });
  }

  // Load client + lead
  const { data: client } = await supabase
    .from("callcapture_clients")
    .select("id, industry, servanahq_enabled, servanahq_tenant_id, is_super_admin")
    .eq("id", client_id).maybeSingle();
  const { data: lead } = await supabase
    .from("callcapture_leads")
    .select("*")
    .eq("id", lead_id).maybeSingle();

  if (!client || !lead) {
    await log("servanahq_check", "error", { reason: "lookup_failed", client: !!client, lead: !!lead });
    return respond({ ok: false, reason: "lookup_failed" });
  }

  // Gate checks
  if (!client.servanahq_enabled) {
    await log("servanahq_check", "skipped", { reason: "disabled" });
    await updateLead({ servanahq_sync_status: "disabled" });
    return respond({ ok: false, reason: "disabled" });
  }
  if (!client.servanahq_tenant_id) {
    await log("servanahq_check", "skipped", { reason: "no_tenant_id" });
    await updateLead({ servanahq_sync_status: "not_configured", servanahq_sync_error: "Missing servanahq_tenant_id" });
    return respond({ ok: false, reason: "no_tenant_id" });
  }
  if (!SERVANAHQ_BASE_URL || !SERVANAHQ_API_KEY) {
    await log("servanahq_check", "skipped", { reason: "global_secrets_missing", base_url: !!SERVANAHQ_BASE_URL, api_key: !!SERVANAHQ_API_KEY });
    await updateLead({ servanahq_sync_status: "not_configured", servanahq_sync_error: "ServanaHQ global secrets not configured" });
    return respond({ ok: false, reason: "not_configured" });
  }

  await log("servanahq_check", "ok", { tenant_id: client.servanahq_tenant_id });
  await log("servanahq_mapping", "ok", { servanahq_tenant_id: client.servanahq_tenant_id, lead_id });

  // Build payload
  const raw = (lead.raw_payload ?? {}) as Json;
  const intake = (lead.intake_answers ?? {}) as Json;
  const callVapiId = (raw.vapi_call_id as string | undefined) ?? vapi_call_id ?? null;

  // Fetch the related call (best-effort) for recording + summary
  let recordingUrl: string | null = null;
  let callSummary: string | null = null;
  if (callVapiId) {
    const { data: callRow } = await supabase
      .from("callcapture_calls")
      .select("recording_url, issue_summary")
      .eq("vapi_call_id", callVapiId).maybeSingle();
    recordingUrl = (callRow as any)?.recording_url ?? null;
    callSummary = (callRow as any)?.issue_summary ?? null;
  }

  const { day, time } = parseTiming(lead.timing as string | null);

  // Map Vektuor fields -> ServanaHQ intake-vapi canonical field names (Path C: top-level fields).
  // intake-vapi requires: customer_name, phone, address, appliance_type, issue_description.
  const serviceLabel =
    (lead as any).treatment ??
    (intake.service_requested as string | undefined) ??
    (intake.appliance_type as string | undefined) ??
    (client as any).industry ??
    "service request";
  const issueText =
    (lead as any).summary ??
    (intake.issue_description as string | undefined) ??
    callSummary ??
    serviceLabel;
  const summaryParts = [
    callSummary,
    day ? `preferred_day=${day}` : null,
    time ? `preferred_time=${time}` : null,
    (lead as any).timing ? `timing=${(lead as any).timing}` : null,
  ].filter(Boolean);

  const body = {
    // tenant routing (ignored by current intake-vapi, honoured once ServanaHQ adds tenant override)
    tenant_id: client.servanahq_tenant_id,
    // canonical intake-vapi fields
    customer_name: (lead as any).name ?? null,
    phone: (lead as any).phone ?? null,
    email: (lead as any).email ?? null,
    address: (lead as any).address ?? null,
    appliance_type: serviceLabel,
    brand: (intake.brand as string | undefined) ?? null,
    model_number: (intake.model_number as string | undefined) ?? null,
    issue_description: issueText,
    ai_summary: summaryParts.join(" | ") || callSummary || null,
    transcript: (raw.transcript as string | undefined) ?? null,
    call_id: callVapiId,
    // extras for downstream reviewers / future use
    source_app: "vektuor",
    recording_url: recordingUrl,
    vektuor_lead_id: lead_id,
    vektuor_client_id: client_id,
    raw_intake: intake,
  };

  const endpoint = `${SERVANAHQ_BASE_URL}/intake-vapi`;
  await log("servanahq_payload", "ok", { fields: Object.keys(body) });
  await log("servanahq_request", "ok", { endpoint, tenant_id: client.servanahq_tenant_id });

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        // Supabase functions edge router requires an apikey/Authorization. Anon key is public-safe.
        apikey: SERVANAHQ_ANON_KEY,
        Authorization: `Bearer ${SERVANAHQ_ANON_KEY}`,
        // Server-to-server shared secret used by ServanaHQ to authenticate Vektuor traffic
        // (intake-vapi will start validating this when the ServanaHQ-side patch is applied).
        "x-vektuor-key": SERVANAHQ_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = String(e);
    await log("servanahq_failed", "error", { phase: "network", error: err });
    await updateLead({ servanahq_sync_status: "failed", servanahq_sync_error: `network: ${err}`.slice(0, 500) });
    return respond({ ok: false, reason: "network", error: err });
  }

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave as text */ }

  await log("servanahq_response", res.ok ? "ok" : "error", {
    status: res.status,
    body: (text ?? "").slice(0, 500),
  });

  if (!res.ok) {
    await log("servanahq_failed", "error", { status: res.status });
    await updateLead({
      servanahq_sync_status: "failed",
      servanahq_sync_error: `HTTP ${res.status}: ${(text ?? "").slice(0, 400)}`,
    });
    return respond({ ok: false, status: res.status, body: json ?? text });
  }

  const servanahqLeadId: string | null = json?.lead_id ?? json?.id ?? null;
  await updateLead({
    servanahq_sync_status: "synced",
    servanahq_synced_at: new Date().toISOString(),
    servanahq_lead_id: servanahqLeadId,
    servanahq_sync_error: null,
  });
  await log("servanahq_synced", "ok", { lead_id: servanahqLeadId });

  return respond({ ok: true, lead_id: servanahqLeadId, response: json });
});