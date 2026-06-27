// Sends booking confirmation emails to the customer and the business owner.
// Uses the Lovable Emails (`send-transactional-email`) function when available.
// Returns ok with `skipped: true` when email infrastructure has not been set up
// yet, so it never blocks the call pipeline.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function tryInvokeEmail(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: string }> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await r.text();
  return { ok: r.ok, status: r.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { client_id, appointment_id } = await req.json();
    if (!client_id || !appointment_id) {
      return new Response(JSON.stringify({ error: "client_id and appointment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const [{ data: appt }, { data: client }] = await Promise.all([
      supabase.from("callcapture_appointments")
        .select("customer_name, customer_phone, customer_email, customer_address, service, notes, start_at, end_at, calendar_event_link")
        .eq("id", appointment_id).maybeSingle(),
      supabase.from("callcapture_clients")
        .select("business_name, timezone, owner_email, email").eq("id", client_id).maybeSingle(),
    ]);
    if (!appt) return new Response(JSON.stringify({ error: "appointment not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const tz = client?.timezone || "America/New_York";
    const when = new Date(appt.start_at).toLocaleString("en-US", {
      timeZone: tz, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const sharedData = {
      business_name: client?.business_name ?? "the team",
      customer_name: appt.customer_name ?? "Customer",
      customer_phone: appt.customer_phone ?? "",
      customer_address: appt.customer_address ?? "",
      service: appt.service ?? "Service appointment",
      when,
      calendar_link: appt.calendar_event_link ?? "",
      notes: appt.notes ?? "",
    };
    const results: Record<string, unknown> = {};
    let infraMissing = false;

    // Customer
    if (appt.customer_email) {
      const r = await tryInvokeEmail({
        templateName: "appointment-confirmation-customer",
        recipientEmail: appt.customer_email,
        idempotencyKey: `appt-cust-${appointment_id}`,
        templateData: sharedData,
      });
      results.customer = { status: r.status };
      if (r.status === 404 || /not.found/i.test(r.body)) infraMissing = true;
    } else {
      results.customer = "no_email";
    }
    // Owner
    const ownerEmail = client?.owner_email || (client as any)?.email;
    if (ownerEmail) {
      const r = await tryInvokeEmail({
        templateName: "appointment-notification-owner",
        recipientEmail: ownerEmail,
        idempotencyKey: `appt-own-${appointment_id}`,
        templateData: sharedData,
      });
      results.owner = { status: r.status };
      if (r.status === 404 || /not.found/i.test(r.body)) infraMissing = true;
    } else {
      results.owner = "no_email";
    }

    return new Response(JSON.stringify({ ok: true, infra_missing: infraMissing, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});