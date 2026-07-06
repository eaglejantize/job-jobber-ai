import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const PayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(25),
  issue: z.string().trim().min(1).max(800).optional(),
  urgency: z.union([z.boolean(), z.string()]).optional(),
  type: z.string().trim().max(80).optional(),
  address: z.string().trim().max(300).optional(),
  treatment: z.string().trim().max(300).optional(),
  new_or_returning: z.string().trim().max(80).optional(),
  timing: z.string().trim().max(300).optional(),
  referral: z.string().trim().max(300).optional(),
  summary: z.string().trim().max(2000).optional(),
  transcript: z.string().trim().max(20000).optional(),
  business_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  dedupe_key: z.string().trim().max(200).optional(),
});

function pick<T>(...vals: (T | undefined | null)[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null && `${v}`.trim() !== "") return v;
  }
  return undefined;
}

function isToolCall(body: any): boolean {
  return !!(body?.toolCallId || body?.tool_call_id);
}

function normalizePhone(p?: string) {
  if (!p) return p;
  return p.replace(/[^\d+]/g, "");
}

function extractIds(body: any) {
  const m = body?.message ?? {};
  const sd =
    m?.analysis?.structuredData ??
    m?.artifact?.structuredData ??
    body?.analysis?.structuredData ??
    body?.structuredData ??
    {};
  return {
    business_id: pick<string>(
      sd.business_id,
      body?.business_id,
      body?.metadata?.business_id,
      body?.call?.metadata?.business_id,
      m?.metadata?.business_id,
    ),
    client_id: pick<string>(
      sd.client_id,
      body?.client_id,
      body?.metadata?.client_id,
      body?.call?.metadata?.client_id,
      m?.metadata?.client_id,
    ),
  };
}

function extractFromToolCall(body: any) {
  const p = body?.parameters ?? body;
  const ids = extractIds(body);
  return {
    name: pick<string>(p.name),
    phone: pick<string>(p.phone),
    issue: pick<string>(p.issue),
    urgency: pick<boolean | string>(p.urgency),
    type: pick<string>(p.type),
    address: pick<string>(p.address),
    treatment: pick<string>(p.treatment),
    new_or_returning: pick<string>(p.newOrReturning, p.new_or_returning),
    timing: pick<string>(p.timing),
    referral: pick<string>(p.referral),
    summary: pick<string>(p.summary),
    transcript: pick<string>(body?.transcript),
    business_id: ids.business_id,
    client_id: ids.client_id,
    dedupe_key: pick<string>(
      body?.toolCallId,
      body?.tool_call_id,
      p?.toolCallId,
      p?.tool_call_id,
    ),
  };
}

function extractFromVapi(body: any) {
  const m = body?.message ?? {};
  const sd =
    m?.analysis?.structuredData ??
    m?.artifact?.structuredData ??
    body?.analysis?.structuredData ??
    body?.structuredData ??
    {};
  const ids = extractIds(body);

  const callId = pick<string>(
    body?.call?.id,
    m?.call?.id,
    body?.callId,
    body?.call_id,
    body?.vapiCallId,
    body?.vapi_call_id,
  );

  return {
    name: pick<string>(sd.name, body?.name, m?.customer?.name),
    phone: pick<string>(
      sd.phone,
      sd.phoneNumber,
      body?.phone,
      m?.customer?.number,
      body?.call?.customer?.number,
    ),
    issue: pick<string>(
      sd.issue,
      sd.summary,
      body?.issue,
      m?.analysis?.summary,
      m?.summary,
      body?.summary,
    ),
    urgency: pick<boolean | string>(sd.urgency, body?.urgency),
    type: pick<string>(sd.type, body?.type),
    address: pick<string>(sd.address, body?.address, m?.customer?.address),
    treatment: pick<string>(sd.treatment, body?.treatment),
    new_or_returning: pick<string>(
      sd.newOrReturning,
      sd.new_or_returning,
      body?.newOrReturning,
      body?.new_or_returning,
    ),
    timing: pick<string>(sd.timing, body?.timing),
    referral: pick<string>(sd.referral, body?.referral),
    summary: pick<string>(sd.summary, m?.analysis?.summary, body?.summary),
    transcript: pick<string>(m?.artifact?.transcript, body?.transcript),
    business_id: ids.business_id,
    client_id: ids.client_id,
    dedupe_key: callId,
  };
}

function isUrgent(u: unknown): boolean {
  if (typeof u === "boolean") return u;
  if (typeof u === "string") return /^(true|yes|urgent|high|1)$/i.test(u.trim());
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VAPI_WEBHOOK_SECRET = Deno.env.get("VAPI_WEBHOOK_SECRET");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const FROM = Deno.env.get("TWILIO_FROM_NUMBER");
    const TO = Deno.env.get("DEMO_OWNER_PHONE");

    if (!VAPI_WEBHOOK_SECRET) throw new Error("VAPI_WEBHOOK_SECRET is not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");
    if (!FROM) throw new Error("TWILIO_FROM_NUMBER is not configured");
    if (!TO) throw new Error("DEMO_OWNER_PHONE is not configured");

    const provided = req.headers.get("x-webhook-secret");
    if (provided !== VAPI_WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.json().catch(() => ({}));
    const extracted = isToolCall(raw) ? extractFromToolCall(raw) : extractFromVapi(raw);

    // Normalize phone before validation
    extracted.phone = normalizePhone(extracted.phone);

    const parsed = PayloadSchema.safeParse(extracted);

    if (!parsed.success) {
      console.error("Validation failed", parsed.error.flatten().fieldErrors);
      return new Response(
        JSON.stringify({
          error: "Invalid payload",
          fields: parsed.error.flatten().fieldErrors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const {
      name,
      phone,
      issue,
      urgency,
      type,
      address,
      treatment,
      new_or_returning,
      timing,
      referral,
      summary,
      transcript,
      business_id,
      client_id,
      dedupe_key,
    } = parsed.data;

    const urgent = isUrgent(urgency);

    const lines = [
      "📞 New CallCapture Lead",
      `Name: ${name}`,
      `Phone: ${phone}`,
    ];
    if (type) lines.push(`Type: ${type}`);
    if (treatment) lines.push(`Treatment: ${treatment}`);
    if (timing) lines.push(`Timing: ${timing}`);
    if (new_or_returning) lines.push(`Status: ${new_or_returning}`);
    if (referral) lines.push(`Heard via: ${referral}`);
    if (urgent) lines.push("⚠️ URGENT");
    if (issue) lines.push(`Issue: ${issue}`);
    if (summary) lines.push(`Summary: ${summary}`);

    const smsBody = lines.join("\n").slice(0, 1500);

    const twilioRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: TO, From: FROM, Body: smsBody }),
    });

    const twilioData = await twilioRes.json();
    if (!twilioRes.ok) {
      console.error("Twilio error", twilioRes.status, twilioData);
      return new Response(
        JSON.stringify({ success: false, status: twilioRes.status, error: twilioData }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Persist lead (best-effort — never fail webhook if DB insert fails)
    let leadId: string | undefined;
    let dbSaved = false;
    let deduped = false;

    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });

        // Basic idempotency: if dedupe key exists, try to find a recently inserted matching lead first
        if (dedupe_key) {
          const { data: existing } = await supabase
            .from("callcapture_leads")
            .select("id, raw_payload")
            .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())
            .limit(100);

          const match = (existing ?? []).find((r: any) => {
            const rp = r?.raw_payload ?? {};
            return (
              rp?.toolCallId === dedupe_key ||
              rp?.tool_call_id === dedupe_key ||
              rp?.callId === dedupe_key ||
              rp?.call_id === dedupe_key ||
              rp?.vapiCallId === dedupe_key ||
              rp?.vapi_call_id === dedupe_key
            );
          });

          if (match?.id) {
            leadId = match.id;
            dbSaved = true;
            deduped = true;
          }
        }

        if (!dbSaved) {
          const intakeAnswers = {
            new_or_returning,
            timing,
            referral,
            treatment,
            issue,
          };

          const { data: inserted, error: insertError } = await supabase
            .from("callcapture_leads")
            .insert({
              name,
              phone,
              issue: issue ?? null,
              type: type ?? null,
              urgency: urgency === undefined || urgency === null ? null : String(urgency),
              address: address ?? null,
              treatment: treatment ?? null,
              new_or_returning: new_or_returning ?? null,
              timing: timing ?? null,
              referral: referral ?? null,
              summary: summary ?? null,
              transcript: transcript ?? null,
              business_id: business_id ?? null,
              client_id: client_id ?? null,
              intake_answers: intakeAnswers,
              raw_payload: raw,
              status: "New",
            })
            .select("id")
            .single();

          if (insertError) {
            console.error("lead insert failed", {
              message: insertError.message,
              code: (insertError as any).code,
              details: (insertError as any).details,
              hint: (insertError as any).hint,
            });
          } else {
            leadId = inserted?.id;
            dbSaved = true;
          }
        }
      } else {
        console.error("lead insert skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
      }
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : "unknown db error";
      console.error("lead insert threw", msg);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sid: twilioData.sid,
        urgent,
        leadId,
        dbSaved,
        deduped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("send-demo-sms error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
