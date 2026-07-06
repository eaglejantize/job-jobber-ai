import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Called by the Vapi agent as a tool at end of conversation.
// Public endpoint — no JWT required.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.json().catch(() => ({}));
    // Vapi tool calls wrap arguments in message.toolCalls[].function.arguments.
    // Accept either flat body or the Vapi tool-call envelope.
    let body: Record<string, unknown> = raw as Record<string, unknown>;
    const toolCall =
      raw?.message?.toolCalls?.[0] ??
      raw?.message?.toolCallList?.[0] ??
      raw?.toolCalls?.[0] ??
      null;
    if (toolCall) {
      const args = toolCall?.function?.arguments ?? toolCall?.arguments ?? {};
      body = typeof args === "string" ? JSON.parse(args) : args;
    }

    const {
      business_phone,
      caller_name,
      caller_phone,
      service_requested,
      appointment_preference,
      new_or_returning,
      referral_source,
      notes,
    } = body ?? {};

    console.log("[submit-intake] received:", {
      business_phone, caller_name, caller_phone, service_requested,
      appointment_preference, new_or_returning, referral_source,
    });

    if (!business_phone || !caller_name || !caller_phone) {
      return new Response(
        JSON.stringify({ error: "business_phone, caller_name, caller_phone required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const norm = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
    const digits = norm(business_phone);

    const { data: clients, error: clientsErr } = await supabase
      .from("callcapture_clients")
      .select("id, business_phone, alert_phone, is_super_admin");
    if (clientsErr) console.log("[submit-intake] clients lookup error:", clientsErr.message);

    let client: { id?: string; business_phone?: string | null; alert_phone?: string | null; is_super_admin?: boolean | null } | null = null;
    if (digits) {
      client = (clients ?? []).find((c) => norm((c as { business_phone?: string | null }).business_phone) === digits) ?? null;
      if (client) console.log("[submit-intake] matched by business_phone ->", client.id);
    }
    if (!client) {
      client = (clients ?? []).find((c) => (c as { is_super_admin?: boolean | null }).is_super_admin === true) ?? null;
      if (client) console.log("[submit-intake] matched by super_admin fallback ->", client.id);
    }
    const clientId = client?.id ?? null;
    if (!clientId) console.log("[submit-intake] no client resolved");

    const insertPayload = {
      client_id: clientId,
      name: caller_name,
      phone: caller_phone,
      treatment: service_requested ?? null,
      timing: appointment_preference ?? null,
      new_or_returning: new_or_returning ?? null,
      referral: referral_source ?? null,
      summary: notes ?? null,
      status: "New",
      raw_payload: { source: "submit-intake", ...body },
    };

    const { data: lead, error } = await supabase
      .from("callcapture_leads")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.log("[submit-intake] lead insert error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[submit-intake] lead inserted:", lead?.id);

    if (clientId && lead?.id && client?.alert_phone) {
      try {
        const smsRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ client_id: clientId, lead_id: lead.id }),
        });
        const smsBody = await smsRes.text();
        console.log("[submit-intake] send-sms status:", smsRes.status, "body:", smsBody);
      } catch (e) {
        console.log("[submit-intake] send-sms invocation failed:", String(e));
      }
    } else {
      console.log("[submit-intake] SMS skipped — missing clientId/lead.id/alert_phone");
    }

    return new Response(JSON.stringify({ success: true, lead_id: lead?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.log("[submit-intake] unhandled error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});