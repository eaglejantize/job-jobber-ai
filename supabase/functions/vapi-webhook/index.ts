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
        .select("id, business_phone, alert_phone, is_super_admin");
      if (clientsErr) console.log("[vapi-webhook] clients lookup error:", clientsErr.message);
      console.log("[vapi-webhook] total clients in db:", clients?.length ?? 0);
      const norm = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

      // First try: match by business_phone
      if (digits) {
        const hit = (clients ?? []).find(
          (c: any) => norm(c.business_phone) && norm(c.business_phone) === digits,
        );
        if (hit) {
          clientId = hit.id;
          console.log("[vapi-webhook] matched by business_phone ->", clientId);
        }
      }

      // Second try: single super admin fallback
      if (!clientId) {
        const admin = (clients ?? []).find((c: any) => c.is_super_admin === true);
        if (admin) {
          clientId = admin.id;
          console.log("[vapi-webhook] matched by super_admin fallback ->", clientId);
        }
      }

      if (!clientId) console.log("[vapi-webhook] no client could be resolved");
    }

    // LLM fallback: when Vapi returned no structured data, extract fields from transcript
    let extracted: Record<string, any> = {};
    const structuredEmpty = !structured || Object.keys(structured).length === 0;
    if (structuredEmpty && transcript && Deno.env.get("LOVABLE_API_KEY")) {
      console.log("[vapi-webhook] structured empty; running LLM extraction on transcript");
      try {
        const sys = `You extract structured lead info from a phone call transcript between an AI receptionist (AI:) and a caller (User:). Return ONLY a JSON object with keys: name, phone, address, issue, urgency, treatment, type, timing, new_or_returning, referral, summary. Omit a key (or use null) if not present. No prose, no markdown.`;
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY")!,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: sys },
              { role: "user", content: `Transcript:\n${transcript}` },
            ],
            response_format: { type: "json_object" },
          }),
        });
        const aiJson = await aiRes.json();
        console.log("[vapi-webhook] LLM status:", aiRes.status);
        const content: string = aiJson?.choices?.[0]?.message?.content ?? "";
        const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        try {
          extracted = JSON.parse(cleaned);
          console.log("[vapi-webhook] LLM extracted keys:", Object.keys(extracted));
        } catch (parseErr) {
          console.log("[vapi-webhook] LLM JSON parse failed:", String(parseErr), "raw:", content.slice(0, 300));
        }
      } catch (e) {
        console.log("[vapi-webhook] LLM extraction failed:", String(e));
      }
    }

    const pick = (...vals: any[]) => vals.find((v) => v !== undefined && v !== null && v !== "") ?? null;

    const insertPayload = {
      client_id: clientId,
      name: pick(structured?.name, extracted?.name, caller?.name),
      phone: pick(caller?.number, caller?.phoneNumber, structured?.phone, extracted?.phone),
      issue: pick(structured?.issue, structured?.reason, extracted?.issue),
      urgency: pick(structured?.urgency, extracted?.urgency),
      address: pick(structured?.address, extracted?.address),
      treatment: pick(structured?.service, structured?.service_type, structured?.treatment, extracted?.treatment, extracted?.service),
      type: pick(structured?.type, extracted?.type),
      timing: pick(structured?.timing, structured?.appointment_preference, structured?.preferred_time, extracted?.timing),
      new_or_returning: pick(structured?.new_or_returning, structured?.client_status, extracted?.new_or_returning),
      referral: pick(structured?.referral, structured?.how_heard, structured?.referral_source, extracted?.referral),
      summary: pick(summary, extracted?.summary),
      transcript,
      intake_answers: structuredEmpty ? extracted : structured,
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
      // Explicit linkage update so the lead row's client_id is guaranteed set.
      const { error: linkErr } = await supabase
        .from("callcapture_leads")
        .update({ client_id: clientId })
        .eq("id", lead.id);
      if (linkErr) console.log("[vapi-webhook] lead link update error:", linkErr.message);
      else console.log("[vapi-webhook] lead linked to client:", clientId);

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