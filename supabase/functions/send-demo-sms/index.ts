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
  issue: z.string().trim().min(1).max(800),
  urgency: z.union([z.boolean(), z.string()]).optional(),
  type: z.string().trim().max(80).optional(),
  address: z.string().trim().max(300).optional(),
});

function pick<T>(...vals: (T | undefined | null)[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null && `${v}`.trim() !== "") return v;
  }
  return undefined;
}

function extractFromVapi(body: any) {
  const m = body?.message ?? {};
  const sd =
    m?.analysis?.structuredData ??
    m?.artifact?.structuredData ??
    body?.analysis?.structuredData ??
    body?.structuredData ??
    {};

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
    address: pick<string>(
      sd.address,
      body?.address,
      m?.customer?.address,
    ),
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
    const extracted = extractFromVapi(raw);
    const parsed = PayloadSchema.safeParse(extracted);

    if (!parsed.success) {
      console.error("Validation failed", parsed.error.flatten().fieldErrors);
      return new Response(
        JSON.stringify({
          error: "Invalid payload",
          fields: parsed.error.flatten().fieldErrors,
          received: extracted,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { name, phone, issue, urgency, type, address } = parsed.data;
    const urgent = isUrgent(urgency);

    const lines = [
      "📞 New CallCapture Lead",
      `Name: ${name}`,
      `Phone: ${phone}`,
    ];
    if (type) lines.push(`Type: ${type}`);
    if (urgent) lines.push("⚠️ URGENT");
    lines.push(`Issue: ${issue}`);
    const body = lines.join("\n").slice(0, 1500);

    const twilioRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: TO, From: FROM, Body: body }),
    });

    const data = await twilioRes.json();
    if (!twilioRes.ok) {
      console.error("Twilio error", twilioRes.status, data);
      return new Response(
        JSON.stringify({ success: false, status: twilioRes.status, error: data }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Persist lead (best-effort — never fail the webhook if DB insert fails)
    let leadId: string | undefined;
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        const { data: inserted, error: insertError } = await supabase
          .from("callcapture_leads")
          .insert({
            name,
            phone,
            issue,
            type: type ?? null,
            urgency: urgency === undefined || urgency === null ? null : String(urgency),
            address: address ?? null,
            raw_payload: raw,
          })
          .select("id")
          .single();
        if (insertError) {
          console.error("lead insert failed", insertError.message);
        } else {
          leadId = inserted?.id;
          console.log("lead inserted", { id: leadId, phone });
        }
      } else {
        console.error("lead insert skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
      }
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : "unknown db error";
      console.error("lead insert threw", msg);
    }

    return new Response(
      JSON.stringify({ success: true, sid: data.sid, urgent, leadId }),
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