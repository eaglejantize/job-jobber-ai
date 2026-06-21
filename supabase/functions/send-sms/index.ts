import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { client_id, lead_id } = await req.json();
    if (!client_id || !lead_id) {
      return new Response(JSON.stringify({ error: "client_id and lead_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: client }, { data: lead }] = await Promise.all([
      supabase.from("callcapture_clients").select("alert_phone, business_name").eq("id", client_id).maybeSingle(),
      supabase.from("callcapture_leads").select("name, phone, summary, issue, treatment, type, timing, new_or_returning, referral").eq("id", lead_id).maybeSingle(),
    ]);

    if (!client?.alert_phone || !lead) {
      console.log("[send-sms] missing client phone or lead", { client_id, lead_id, hasClient: !!client, hasLead: !!lead });
      return new Response(JSON.stringify({ skipped: true, reason: "missing client phone or lead" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
    const missing = [
      !LOVABLE_API_KEY && "LOVABLE_API_KEY",
      !TWILIO_API_KEY && "TWILIO_API_KEY",
      !fromNumber && "TWILIO_FROM_NUMBER",
    ].filter(Boolean);
    if (missing.length) {
      console.log("[send-sms] missing env vars:", missing);
      return new Response(JSON.stringify({ error: "Twilio not configured", missing }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lines = [
      `New ${client.business_name ?? "CallCapture"} lead`,
      lead.name ? `Name: ${lead.name}` : null,
      lead.phone ? `Phone: ${lead.phone}` : null,
      (lead.treatment ?? lead.type ?? lead.issue) ? `Service: ${lead.treatment ?? lead.type ?? lead.issue}` : null,
      lead.timing ? `When: ${lead.timing}` : null,
      lead.new_or_returning ? `Status: ${lead.new_or_returning}` : null,
      lead.referral ? `Heard via: ${lead.referral}` : null,
    ].filter(Boolean);
    const body = lines.join("\n");
    console.log("[send-sms] sending to", client.alert_phone, "body:", body);

    const params = new URLSearchParams({ From: fromNumber!, To: client.alert_phone, Body: body });

    const tr = await fetch(`https://connector-gateway.lovable.dev/twilio/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY!,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const trBody = await tr.text();
    console.log("[send-sms] twilio status:", tr.status, "body:", trBody);
    if (!tr.ok) {
      return new Response(JSON.stringify({ error: trBody }), {
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