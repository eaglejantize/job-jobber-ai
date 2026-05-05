import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const areaCode = String(body.area_code ?? "").trim();
    if (!/^\d{3}$/.test(areaCode)) {
      return json({ error: "area_code must be 3 digits" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return json({ error: "Twilio not configured" }, 500);
    }

    const params = new URLSearchParams({
      AreaCode: areaCode,
      SmsEnabled: "true",
      VoiceEnabled: "true",
      PageSize: "5",
    });

    const r = await fetch(
      `${GATEWAY_URL}/AvailablePhoneNumbers/US/Local.json?${params}`,
      {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
        },
      },
    );
    const data = await r.json();
    if (!r.ok) {
      console.error("Twilio search error", r.status, data);
      return json({ error: data?.message ?? "Twilio search failed" }, 502);
    }

    const numbers = (data.available_phone_numbers ?? []).slice(0, 5).map((n: any) => ({
      phone_number: n.phone_number,
      friendly_name: n.friendly_name,
      locality: n.locality ?? null,
      region: n.region ?? null,
    }));

    return json({ numbers });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}