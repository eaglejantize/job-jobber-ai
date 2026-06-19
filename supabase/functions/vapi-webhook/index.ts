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

    // Only process end-of-call reports.
    const type = event?.type ?? event?.event ?? "";
    if (type && !String(type).toLowerCase().includes("end-of-call") && !String(type).toLowerCase().includes("call.ended")) {
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
    const analysis = event?.analysis ?? {};
    const structured = analysis?.structuredData ?? analysis?.structured_data ?? {};
    const transcript: string | null = event?.transcript ?? event?.call?.transcript ?? null;
    const summary: string | null = analysis?.summary ?? null;
    const caller = event?.customer ?? event?.call?.customer ?? {};

    // Fallback: resolve client_id by the dialed number on the Vapi event.
    if (!clientId) {
      const dialed: string | null =
        event?.phoneNumber?.number ??
        event?.call?.phoneNumber?.number ??
        event?.call?.to ??
        event?.to ??
        null;
      const digits = (dialed ?? "").replace(/\D/g, "");
      if (digits) {
        const { data: clients } = await supabase
          .from("callcapture_clients")
          .select("id, assigned_callcapture_number, business_phone, alert_phone");
        const norm = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
        const hit = (clients ?? []).find((c: any) =>
          [c.assigned_callcapture_number, c.business_phone, c.alert_phone]
            .some((p) => norm(p) && norm(p) === digits)
        );
        if (hit) clientId = hit.id;
      }
    }

    const insertPayload = {
      client_id: clientId,
      name: structured?.name ?? caller?.name ?? null,
      phone: caller?.number ?? caller?.phoneNumber ?? structured?.phone ?? null,
      issue: structured?.issue ?? structured?.reason ?? null,
      urgency: structured?.urgency ?? null,
      address: structured?.address ?? null,
      summary,
      transcript,
      intake_answers: structured,
      raw_payload: event,
      status: "New",
    };

    const { data: lead, error } = await supabase
      .from("callcapture_leads")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire SMS alert (best-effort, do not block on failure).
    if (clientId && lead?.id) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ client_id: clientId, lead_id: lead.id }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, lead_id: lead?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});