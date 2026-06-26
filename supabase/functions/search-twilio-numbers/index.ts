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
    const region = String(body.region ?? "").trim().toUpperCase().slice(0, 2);
    if (!/^\d{3}$/.test(areaCode) && !region) {
      return json({ error_code: "bad_request", error: "area_code (3 digits) or region required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return json({ error_code: "missing_secret", error: "Twilio not configured" }, 500);
    }

    async function search(query: Record<string, string>) {
      const params = new URLSearchParams({
        SmsEnabled: "true",
        VoiceEnabled: "true",
        PageSize: "5",
        ...query,
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
      const data = await r.json().catch(() => ({} as any));
      return { ok: r.ok, status: r.status, data };
    }

    function mapNumbers(data: any) {
      return (data?.available_phone_numbers ?? []).slice(0, 5).map((n: any) => ({
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        locality: n.locality ?? null,
        region: n.region ?? null,
      }));
    }

    // Primary lookup by area code (or region if no area code)
    const primary = areaCode
      ? await search({ AreaCode: areaCode })
      : await search({ InRegion: region });

    if (!primary.ok) {
      console.error("Twilio search error", primary.status, primary.data);
      const code =
        primary.status === 401 || primary.status === 403
          ? "twilio_auth_failed"
          : "twilio_error";
      return json(
        { error_code: code, error: primary.data?.message ?? "Twilio search failed", status: primary.status },
        502,
      );
    }

    const numbers = mapNumbers(primary.data);
    if (numbers.length > 0) return json({ numbers, fallback_reason: null, nearby: [] });

    // Fallback 1: search by region (state) if we had one
    let nearby: any[] = [];
    let fallback_reason: string | null = "no_numbers_in_area_code";
    if (region) {
      const byRegion = await search({ InRegion: region });
      if (byRegion.ok) nearby = mapNumbers(byRegion.data);
    }
    // Fallback 2: any US local
    if (nearby.length === 0) {
      const anyUs = await search({});
      if (anyUs.ok) nearby = mapNumbers(anyUs.data);
      fallback_reason = "no_numbers_in_area_code_showing_us";
    }

    return json({ numbers: [], nearby, fallback_reason });
  } catch (e) {
    console.error(e);
    return json({ error_code: "exception", error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}