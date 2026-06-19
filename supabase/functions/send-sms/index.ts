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
      supabase.from("callcapture_leads").select("name, phone, summary, issue").eq("id", lead_id).maybeSingle(),
    ]);

    if (!client?.alert_phone || !lead) {
      return new Response(JSON.stringify({ skipped: true, reason: "missing client phone or lead" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountSid = Deno.env.get("TWILIO_API_KEY")?.split(":")[0]
      ?? Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_API_KEY")?.split(":")[1]
      ?? Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(JSON.stringify({ error: "Twilio not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = `New ${client.business_name ?? "Vektuor"} lead:
${lead.name ?? "Unknown caller"}${lead.phone ? " · " + lead.phone : ""}
${lead.summary ?? lead.issue ?? "See dashboard for details."}`;

    const auth = btoa(`${accountSid}:${authToken}`);
    const params = new URLSearchParams({ From: fromNumber, To: client.alert_phone, Body: body });

    const tr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const trBody = await tr.text();
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