import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Vapi end-of-call webhook: inserts a lead row and triggers an SMS alert.
// Configure this URL in Vapi's assistant -> server URL with the optional
// secret HMAC header. We accept either ?client_id=<uuid> in the query
// string or metadata.client_id in the payload.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const event = body?.message ?? body;

    const type = event?.type ?? event?.event ?? "";
    console.log("[vapi-webhook] received event type:", type);
    if (type && !String(type).toLowerCase().includes("end-of-call") && !String(type).toLowerCase().includes("call.ended")) {
      console.log("[vapi-webhook] skipping non-end-of-call event");
      return new Response(JSON.stringify({ skipped: true, type }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const meta = event?.call?.metadata ?? event?.metadata ?? {};
    let clientId: string | null = url.searchParams.get("client_id") ?? meta?.client_id ?? null;
    console.log("[vapi-webhook] initial clientId from query/meta:", clientId);
    const analysis = event?.analysis ?? {};
    const structured = analysis?.structuredData ?? analysis?.structured_data ?? {};
    const transcript: string | null = event?.transcript ?? event?.call?.transcript ?? null;
    const summary: string | null = analysis?.summary ?? null;
    const caller = event?.customer ?? event?.call?.customer ?? {};

    if (!clientId) {
      const dialed: string | null =
        event?.phoneNumber?.number ??
        event?.call?.phoneNumber?.number ??
        event?.call?.to ??
        event?.to ??
        null;
      console.log("[vapi-webhook] dialed assistant number:", dialed);
      const digits = (dialed ?? "").replace(/\D/g, "");
      const { data: clients, error: clientsErr } = await supabase
        .from("callcapture_clients")
        .select("id, assigned_callcapture_number, business_phone, alert_phone");
      if (clientsErr) console.log("[vapi-webhook] clients lookup error:", clientsErr.message);
      console.log("[vapi-webhook] total clients in db:", clients?.length ?? 0);
      const norm = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
      if (digits) {
        const hit = (clients ?? []).find((c: any) =>
          [c.assigned_callcapture_number, c.business_phone, c.alert_phone]
            .some((p) => norm(p) && norm(p) === digits)
        );
        if (hit) {
          clientId = hit.id;
          console.log("[vapi-webhook] matched client by dialed number:", clientId);
        } else {
          console.log("[vapi-webhook] no client matched dialed digits:", digits);
        }
      }
      if (!clientId && (clients?.length ?? 0) === 1) {
        clientId = clients![0].id;
        console.log("[vapi-webhook] single-client fallback ->", clientId);
      }
      if (!clientId) console.log("[vapi-webhook] no client could be resolved");
    }

    const insertPayload = {
      client_id: clientId,
      name: structured?.name ?? caller?.name ?? null,
      phone: caller?.number ?? caller?.phoneNumber ?? structured?.phone ?? null,
      issue: structured?.issue ?? structured?.reason ?? null,
      urgency: structured?.urgency ?? null,
      address: structured?.address ?? null,
      treatment: structured?.service ?? structured?.service_type ?? structured?.treatment ?? null,
      type: structured?.type ?? null,
      timing: structured?.timing ?? structured?.appointment_preference ?? structured?.preferred_time ?? null,
      new_or_returning: structured?.new_or_returning ?? structured?.client_status ?? null,
      referral: structured?.referral ?? structured?.how_heard ?? structured?.referral_source ?? null,
      summary,
      transcript,
      intake_answers: structured,
      raw_payload: event,
      status: "New",
    };
    console.log("[vapi-webhook] inserting lead with client_id:", clientId);

    const { data: lead, error } = await supabase
      .from("callcapture_leads")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.log("[vapi-webhook] lead insert error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[vapi-webhook] lead inserted:", lead?.id);

    if (clientId && lead?.id) {
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
        console.log("[vapi-webhook] send-sms status:", smsRes.status, "body:", smsBody);
      } catch (e) {
        console.log("[vapi-webhook] send-sms invocation failed:", String(e));
      }
    } else {
      console.log("[vapi-webhook] SMS skipped — no clientId or lead.id");
    }

    return new Response(JSON.stringify({ ok: true, lead_id: lead?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.log("[vapi-webhook] unhandled error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});