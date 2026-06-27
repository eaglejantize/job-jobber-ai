import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
        .select("customer_name, customer_phone, service, start_at, customer_address")
        .eq("id", appointment_id).maybeSingle(),
      supabase.from("callcapture_clients")
        .select("business_name, timezone").eq("id", client_id).maybeSingle(),
    ]);
    if (!appt?.customer_phone) {
      return new Response(JSON.stringify({ skipped: true, reason: "no customer phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !fromNumber) {
      return new Response(JSON.stringify({ error: "Twilio not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const when = new Date(appt.start_at).toLocaleString("en-US", {
      timeZone: client?.timezone || "America/New_York",
      weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    const body = [
      `Hi ${appt.customer_name ?? "there"}, this confirms your ${appt.service ?? "appointment"} with ${client?.business_name ?? "us"} on ${when}.`,
      appt.customer_address ? `Address on file: ${appt.customer_address}` : null,
      "Reply to this message if anything changes.",
    ].filter(Boolean).join(" ");
    const params = new URLSearchParams({ From: fromNumber, To: appt.customer_phone, Body: body });
    const tr = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const txt = await tr.text();
    if (!tr.ok) {
      return new Response(JSON.stringify({ error: txt }), {
        status: tr.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});