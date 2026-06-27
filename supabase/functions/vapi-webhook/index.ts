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

function normalize(p: string | null | undefined): string {
  return (p ?? "").replace(/\D/g, "");
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

  const logEvent = async (
    clientId: string | null,
    vapiCallId: string | null,
    step: string,
    status: "ok" | "error" | "skipped",
    detail?: unknown,
  ) => {
    try {
      await supabase.from("callcapture_webhook_events").insert({
        client_id: clientId,
        vapi_call_id: vapiCallId,
        step,
        status,
        detail: detail ? (detail as any) : null,
      });
    } catch (e) {
      console.error("diag insert failed", e);
    }
  };

  let body: Json = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const msg = (body.message ?? body) as Json;
  const type = getStr(msg, "type") ?? "";
  const callObj = (msg.call as Json | undefined) ?? {};
  const vapiCallId = getStr(callObj, "id") ?? getStr(msg, "callId") ?? "";
  const customer = (callObj.customer as Json | undefined) ?? (msg.customer as Json | undefined) ?? {};
  const callerPhone = getStr(customer, "number", "phoneNumber") ?? null;
  const callerName = getStr(customer, "name") ?? null;
  const phoneNumberId = getStr(callObj, "phoneNumberId") ?? getStr(msg, "phoneNumberId");
  const phoneObj = (callObj.phoneNumber as Json | undefined) ?? {};
  const calledNumber = getStr(phoneObj, "number") ?? getStr(callObj, "to", "calledNumber");
  const metaObj = ((callObj.metadata as Json | undefined) ?? (msg.metadata as Json | undefined) ?? {}) as Json;
  const metaClientId = getStr(metaObj, "client_id", "clientId");

  await logEvent(metaClientId ?? null, vapiCallId || null, "received", "ok", { type, phoneNumberId, calledNumber });

  if (!vapiCallId) {
    await logEvent(null, null, "received", "skipped", { reason: "no_call_id" });
    return new Response(JSON.stringify({ ok: true, ignored: "no call id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Tenant resolution: metadata → vapi_phone_number_id → assigned_callcapture_number → vapi_assistant_id
  const assistantId = getStr(callObj, "assistantId") ?? getStr(msg, "assistantId");
  let clientId: string | null = null;
  let businessId: string | null = null;
  let matchedBy = "none";

  if (metaClientId) {
    const { data } = await supabase.from("callcapture_clients").select("id").eq("id", metaClientId).maybeSingle();
    if (data?.id) { clientId = data.id; matchedBy = "metadata"; }
  }
  if (!clientId && phoneNumberId) {
    const { data } = await supabase.from("callcapture_clients").select("id").eq("vapi_phone_number_id", phoneNumberId).maybeSingle();
    if (data?.id) { clientId = data.id; matchedBy = "vapi_phone_number_id"; }
  }
  if (!clientId && calledNumber) {
    const digits = normalize(calledNumber);
    const { data: all } = await supabase.from("callcapture_clients").select("id, assigned_callcapture_number, is_super_admin");
    const hit = (all ?? []).find((c: any) => normalize(c.assigned_callcapture_number) === digits && !c.is_super_admin);
    if (hit?.id) { clientId = hit.id; matchedBy = "assigned_callcapture_number"; }
  }
  if (!clientId && assistantId) {
    const { data } = await supabase.from("callcapture_clients").select("id").eq("vapi_assistant_id", assistantId).maybeSingle();
    if (data?.id) { clientId = data.id; matchedBy = "vapi_assistant_id"; }
  }

  // Safety: never write to super admin row for tenant calls
  if (clientId) {
    const { data: c } = await supabase.from("callcapture_clients").select("is_super_admin, business_id").eq("id", clientId).maybeSingle();
    if (c?.is_super_admin) {
      await logEvent(clientId, vapiCallId, "tenant_matched", "error", { reason: "resolved_to_super_admin", matchedBy });
      clientId = null;
    } else {
      businessId = (c as any)?.business_id ?? null;
    }
  }

  await logEvent(clientId, vapiCallId, "tenant_matched", clientId ? "ok" : "error", { matchedBy, assistantId, phoneNumberId, calledNumber });

  // Find or create the call row
  const { data: existing } = await supabase
    .from("callcapture_calls")
    .select("id, client_id")
    .eq("vapi_call_id", vapiCallId).maybeSingle();

  let callId = existing?.id ?? null;
  if (!callId) {
    const { data: ins, error: insErr } = await supabase.from("callcapture_calls").insert({
      vapi_call_id: vapiCallId,
      client_id: clientId,
      business_id: businessId,
      caller_name: callerName,
      caller_phone: callerPhone,
      status: "live",
      metadata: metaObj as any,
    }).select("id").single();
    callId = ins?.id ?? null;
    await logEvent(clientId, vapiCallId, "call_started", callId ? "ok" : "error", { error: insErr?.message });
  } else if (existing && !existing.client_id && clientId) {
    await supabase.from("callcapture_calls").update({ client_id: clientId }).eq("id", existing.id);
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
      await logEvent(clientId, vapiCallId, "transcript_received", "ok", { role, len: text.length });
    }
  } else if (type === "transfer-destination-request") {
    await supabase.from("callcapture_calls").update({ status: "transferred" }).eq("id", callId);
  } else if (type === "end-of-call-report") {
    const summary = getStr(msg, "summary") ?? getStr(callObj, "summary");
    const recording = getStr(msg, "recordingUrl") ?? getStr(callObj, "recordingUrl");
    const transcriptText = getStr(msg, "transcript") ?? getStr(callObj, "transcript");
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
    await logEvent(clientId, vapiCallId, "call_ended", "ok", { duration });

    // Extract lead fields from transcript via Lovable AI Gateway
    let extracted: any = {};
    if (transcriptText) {
      try {
        const aiKey = Deno.env.get("LOVABLE_API_KEY");
        if (aiKey) {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Extract lead fields from a phone-call transcript. Respond ONLY with compact JSON containing: name, phone, address, service, timing, new_or_returning, referral, notes. Use null when unknown." },
                { role: "user", content: transcriptText },
              ],
            }),
          });
          if (r.ok) {
            const j = await r.json();
            const content: string = j?.choices?.[0]?.message?.content ?? "{}";
            const cleaned = content.replace(/^```json\s*|```$/g, "").trim();
            extracted = JSON.parse(cleaned);
            await logEvent(clientId, vapiCallId, "lead_extracted", "ok", extracted);
          } else {
            await logEvent(clientId, vapiCallId, "lead_extracted", "error", { status: r.status });
          }
        }
      } catch (e) {
        await logEvent(clientId, vapiCallId, "lead_extracted", "error", { error: String(e) });
      }
    } else {
      await logEvent(clientId, vapiCallId, "lead_extracted", "skipped", { reason: "no_transcript" });
    }

    // Create lead (tenant-scoped, dedupe by vapi_call_id in raw_payload)
    let leadId: string | null = null;
    if (clientId) {
      const { data: dup } = await supabase
        .from("callcapture_leads")
        .select("id")
        .eq("client_id", clientId)
        .filter("raw_payload->>vapi_call_id", "eq", vapiCallId)
        .maybeSingle();
      if (dup?.id) {
        leadId = dup.id;
        await logEvent(clientId, vapiCallId, "lead_created", "skipped", { reason: "duplicate", lead_id: leadId });
      } else {
        const { data: lead, error: leadErr } = await supabase.from("callcapture_leads").insert({
          client_id: clientId,
          name: extracted.name ?? callerName,
          phone: extracted.phone ?? callerPhone,
          treatment: extracted.service ?? null,
          timing: extracted.timing ?? null,
          new_or_returning: extracted.new_or_returning ?? null,
          referral: extracted.referral ?? null,
          summary: summary ?? extracted.notes ?? null,
          status: "New",
          raw_payload: { vapi_call_id: vapiCallId, source: "vapi-webhook", extracted, transcript: transcriptText },
        }).select("id").single();
        leadId = lead?.id ?? null;
        await logEvent(clientId, vapiCallId, "lead_created", leadId ? "ok" : "error", { lead_id: leadId, error: leadErr?.message });
        if (callId && leadId) await supabase.from("callcapture_calls").update({ lead_id: leadId }).eq("id", callId);
      }
    } else {
      await logEvent(null, vapiCallId, "lead_created", "skipped", { reason: "no_tenant" });
    }

    // Tenant-scoped SMS notification
    if (clientId && leadId) {
      try {
        const smsRes = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId, lead_id: leadId }),
        });
        const txt = await smsRes.text();
        await logEvent(clientId, vapiCallId, smsRes.ok ? "sms_sent" : "sms_failed", smsRes.ok ? "ok" : "error", { status: smsRes.status, body: txt });
      } catch (e) {
        await logEvent(clientId, vapiCallId, "sms_failed", "error", { error: String(e) });
      }
    } else {
      await logEvent(clientId, vapiCallId, "sms_sent", "skipped", { reason: !clientId ? "no_tenant" : "no_lead" });
    }

    // If an appointment was booked during the call (via the bookSlot tool),
    // send customer SMS + customer email + owner email confirmations.
    if (clientId && leadId) {
      const { data: leadRow } = await supabase
        .from("callcapture_leads")
        .select("appointment_id, email")
        .eq("id", leadId).maybeSingle();
      const apptId = leadRow?.appointment_id ?? null;
      if (apptId) {
        // Customer SMS confirmation
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/send-customer-sms`, {
            method: "POST",
            headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: clientId, appointment_id: apptId }),
          });
          const txt = await r.text();
          await logEvent(clientId, vapiCallId, r.ok ? "customer_sms_sent" : "customer_sms_failed", r.ok ? "ok" : "error", { status: r.status, body: txt.slice(0, 300) });
        } catch (e) {
          await logEvent(clientId, vapiCallId, "customer_sms_failed", "error", { error: String(e) });
        }
        // Email confirmations (no-op until email infra is set up)
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/send-appointment-emails`, {
            method: "POST",
            headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: clientId, appointment_id: apptId }),
          });
          const txt = await r.text();
          await logEvent(clientId, vapiCallId, r.ok ? "emails_sent" : "emails_failed", r.ok ? "ok" : "error", { status: r.status, body: txt.slice(0, 300) });
        } catch (e) {
          await logEvent(clientId, vapiCallId, "emails_failed", "error", { error: String(e) });
        }
      } else {
        await logEvent(clientId, vapiCallId, "appointment_booked", "skipped", { reason: "no_appointment_on_lead" });
      }
    }

    // ServanaHQ sync — fire-and-forget, never blocks lead capture.
    if (clientId && leadId) {
      try {
        const syncRes = await fetch(`${SUPABASE_URL}/functions/v1/sync-servanahq`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId, lead_id: leadId, vapi_call_id: vapiCallId }),
        });
        const txt = await syncRes.text();
        console.log("[vapi-webhook] servanahq sync", syncRes.status, txt.slice(0, 300));
      } catch (e) {
        console.error("[vapi-webhook] servanahq sync invoke failed", e);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, call_id: callId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});