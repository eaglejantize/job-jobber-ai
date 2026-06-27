import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createEvent, resolveAuthForClient } from "../_shared/google-calendar.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const {
      client_id, lead_id, vapi_call_id,
      start_iso, end_iso,
      customer_name, customer_phone, customer_email, customer_address,
      service, notes,
    } = body as Record<string, any>;

    if (!client_id || !start_iso || !end_iso) {
      return new Response(JSON.stringify({ error: "client_id, start_iso, end_iso required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: client, error } = await supabase
      .from("callcapture_clients")
      .select("id, business_name, google_calendar_id, timezone, google_oauth_access_token, google_oauth_expires_at")
      .eq("id", client_id).maybeSingle();
    if (error || !client) {
      return new Response(JSON.stringify({ error: "client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const calendarId = client.google_calendar_id || "primary";
    const timezone = client.timezone || "America/New_York";
    const auth = await resolveAuthForClient(client as any);

    const summary = `${service ?? "Service call"} — ${customer_name ?? "Customer"}`;
    const description = [
      customer_name && `Name: ${customer_name}`,
      customer_phone && `Phone: ${customer_phone}`,
      customer_email && `Email: ${customer_email}`,
      customer_address && `Address: ${customer_address}`,
      service && `Service: ${service}`,
      notes && `Notes: ${notes}`,
      vapi_call_id && `Vapi call: ${vapi_call_id}`,
    ].filter(Boolean).join("\n");

    const ev = await createEvent(auth, {
      calendarId, summary, description,
      startIso: start_iso, endIso: end_iso, timeZone: timezone,
      attendeeEmail: customer_email ?? null,
      location: customer_address ?? null,
    });

    const { data: appt, error: apptErr } = await supabase.from("callcapture_appointments").insert({
      client_id, lead_id: lead_id ?? null,
      customer_name, customer_phone, customer_email, customer_address,
      service, notes,
      start_at: start_iso, end_at: end_iso, status: "scheduled",
      calendar_provider: "google",
      calendar_event_id: ev.id, calendar_event_link: ev.htmlLink,
    }).select("id").single();
    if (apptErr) throw apptErr;

    if (lead_id) {
      await supabase.from("callcapture_leads").update({
        appointment_id: appt.id, booking_status: "booked",
      }).eq("id", lead_id);
    }

    // Flip the corresponding call row to `booked` so the Dashboard updates in real time.
    try {
      const callQuery = supabase.from("callcapture_calls").update({
        status: "booked",
        lead_id: lead_id ?? undefined,
      });
      if (vapi_call_id) {
        await callQuery.eq("vapi_call_id", vapi_call_id);
      } else if (lead_id) {
        await callQuery.eq("lead_id", lead_id);
      }
    } catch (e) {
      console.error("[calendar-book-slot] call status update failed", e);
    }

    return new Response(JSON.stringify({
      ok: true, appointment_id: appt.id,
      calendar_event_id: ev.id, calendar_event_link: ev.htmlLink,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});