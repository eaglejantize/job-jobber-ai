// Vapi server-tools endpoint. Dispatches `findSlots` and `bookSlot` tool calls
// from the AI assistant during a live call. Tenant is resolved from the Vapi
// call metadata (set by provision-twilio-number).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  freeBusy, generateCandidateSlots, filterAvailable,
  createEvent, resolveAuthForClient,
} from "../_shared/google-calendar.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function handleFindSlots(supabase: { from: unknown }, clientId: string, args: Record<string, unknown>) {
  const days = Math.min(Math.max(Number(args?.days ?? 5), 1), 14);
  const max = Math.min(Math.max(Number(args?.max ?? 6), 1), 10);
  const { data: client } = await supabase
    .from("callcapture_clients")
    .select("id, google_calendar_id, timezone, default_job_duration_minutes, business_hours, google_oauth_access_token")
    .eq("id", clientId).maybeSingle();
  if (!client) return { error: "tenant not found" };
  const calendarId = client.google_calendar_id || "primary";
  const timezone = client.timezone || "America/New_York";
  const duration = client.default_job_duration_minutes || 60;
  const hours = (client.business_hours as { start?: string; end?: string } | null) || { start: "08:00", end: "18:00" };
  const now = new Date();
  const timeMax = new Date(now.getTime() + days * 86400000);
  const auth = await resolveAuthForClient(client);
  const busy = await freeBusy(auth, calendarId, now.toISOString(), timeMax.toISOString(), timezone);
  const candidates = generateCandidateSlots({
    fromIso: now.toISOString(), days, durationMinutes: duration, businessHours: hours,
  });
  const free = filterAvailable(candidates, busy).slice(0, max);
  // Human-readable summary so the AI can read it aloud
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: timezone,
  });
  const readable = free.map((s) => ({ ...s, label: fmt.format(new Date(s.startIso)) }));
  return { timezone, duration_minutes: duration, slots: readable };
}

async function handleBookSlot(supabase: { from: unknown }, clientId: string, vapiCallId: string | null, args: Record<string, unknown>) {
  const { start_iso, end_iso, customer_name, customer_phone, customer_email, customer_address, service, notes } = args ?? {};
  if (!start_iso || !end_iso) return { error: "start_iso and end_iso required" };
  const { data: client } = await supabase
    .from("callcapture_clients")
    .select("id, business_name, google_calendar_id, timezone, google_oauth_access_token")
    .eq("id", clientId).maybeSingle();
  if (!client) return { error: "tenant not found" };
  const calendarId = client.google_calendar_id || "primary";
  const timezone = client.timezone || "America/New_York";
  const auth = await resolveAuthForClient(client);
  // Find linked lead for this call (if any)
  let leadId: string | null = null;
  if (vapiCallId) {
    const { data: call } = await supabase.from("callcapture_calls")
      .select("id, lead_id").eq("vapi_call_id", vapiCallId).maybeSingle();
    leadId = call?.lead_id ?? null;
  }
  const summary = `${service ?? "Service call"} — ${customer_name ?? "Customer"}`;
  const description = [
    customer_name && `Name: ${customer_name}`,
    customer_phone && `Phone: ${customer_phone}`,
    customer_email && `Email: ${customer_email}`,
    customer_address && `Address: ${customer_address}`,
    service && `Service: ${service}`,
    notes && `Notes: ${notes}`,
    vapiCallId && `Vapi call: ${vapiCallId}`,
  ].filter(Boolean).join("\n");
  const ev = await createEvent(auth, {
    calendarId, summary, description,
    startIso: start_iso, endIso: end_iso, timeZone: timezone,
    attendeeEmail: customer_email ?? null,
    location: customer_address ?? null,
  });
  const { data: appt } = await supabase.from("callcapture_appointments").insert({
    client_id: clientId, lead_id: leadId,
    customer_name, customer_phone, customer_email, customer_address, service, notes,
    start_at: start_iso, end_at: end_iso, status: "scheduled",
    calendar_provider: "google",
    calendar_event_id: ev.id, calendar_event_link: ev.htmlLink,
  }).select("id").single();
  if (leadId && appt) {
    await supabase.from("callcapture_leads").update({
      appointment_id: appt.id, booking_status: "booked",
      email: customer_email ?? null,
    }).eq("id", leadId);
  }
  return {
    ok: true,
    appointment_id: appt?.id,
    confirmation: `Booked ${customer_name ?? "the appointment"} for ${new Date(start_iso).toLocaleString("en-US", { timeZone: timezone })}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const msg = body?.message ?? body;
    const toolCalls = msg?.toolCalls ?? msg?.tool_calls ?? [];
    const call = msg?.call ?? {};
    const meta = call?.metadata ?? msg?.metadata ?? {};
    const vapiCallId: string | null = call?.id ?? null;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Resolve tenant from metadata (set at assistant provisioning) or by phoneNumberId / assistantId.
    let clientId: string | null = typeof meta?.client_id === "string" ? meta.client_id : null;
    if (!clientId) {
      const phoneNumberId = call?.phoneNumberId ?? msg?.phoneNumberId;
      if (phoneNumberId) {
        const { data } = await supabase.from("callcapture_clients").select("id").eq("vapi_phone_number_id", phoneNumberId).maybeSingle();
        clientId = data?.id ?? null;
      }
    }
    if (!clientId) {
      const assistantId = call?.assistantId ?? msg?.assistantId;
      if (assistantId) {
        const { data } = await supabase.from("callcapture_clients").select("id").eq("vapi_assistant_id", assistantId).maybeSingle();
        clientId = data?.id ?? null;
      }
    }
    if (!clientId) {
      return new Response(JSON.stringify({ results: toolCalls.map((tc: { id?: string }) => ({ toolCallId: tc.id ?? "", result: "Tenant not resolved." })) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ toolCallId: string; result: string }> = [];
    for (const tc of toolCalls) {
      const name = tc?.function?.name ?? tc?.name;
      let args: Record<string, unknown> = tc?.function?.arguments ?? tc?.arguments ?? {};
      if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
      let out: unknown;
      try {
        if (name === "findSlots") out = await handleFindSlots(supabase, clientId, args);
        else if (name === "bookSlot") out = await handleBookSlot(supabase, clientId, vapiCallId, args);
        else out = { error: `unknown tool ${name}` };
      } catch (e) {
        out = { error: String(e?.message ?? e) };
      }
      results.push({ toolCallId: tc.id ?? tc.toolCallId ?? "", result: JSON.stringify(out) });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});