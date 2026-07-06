import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import {
  getIndustryLookupLabels,
  industryValueFromLookupLabel,
} from "../_shared/industry-definition.ts";

const INDUSTRY_LABELS = getIndustryLookupLabels();

const SearchSchema = z.object({
  mode: z.literal("search").optional(),
  name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(50).optional(),
}).refine((v) => (v.name && v.name.length >= 2) || (v.phone && v.phone.replace(/\D/g, "").length >= 7), {
  message: "Provide a business name or phone number",
});

const DetailsSchema = z.object({
  mode: z.literal("details"),
  place_id: z.string().min(3).max(255),
});

function toE164(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "+" + digits;
}

async function suggestWithAI(opts: {
  businessName: string; industry?: string; types?: string[]; address?: string;
}) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const sys = `You classify small service businesses and draft an AI phone receptionist setup.
You MUST pick the industry from this exact list (use the label verbatim):
${INDUSTRY_LABELS.map((l) => `- ${l}`).join("\n")}

Return ONLY a JSON object with this exact shape, no commentary, no markdown:
{"industry":"<one label from the list>","greeting":"<one short greeting under 25 words>","intakeQuestions":["q1","q2","q3","q4","q5"]}
Intake questions must be 5-7 short items relevant to the industry (e.g. "Caller name", "Service address", "Equipment make/model"). The greeting should mention the business by name and be friendly and natural.`;

  const user = `Business name: ${opts.businessName}
${opts.address ? `Address: ${opts.address}` : ""}
${opts.types?.length ? `Google place types: ${opts.types.join(", ")}` : ""}
${opts.industry ? `Known industry: ${opts.industry}` : ""}`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`AI gateway ${r.status}: ${text}`);
  }
  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  const cleaned = String(raw).replace(/^```json\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(cleaned);
  const label = INDUSTRY_LABELS.includes(parsed.industry) ? parsed.industry : "Other";
  return {
    industry_label: label,
    industry_value: industryValueFromLookupLabel(label),
    greeting: String(parsed.greeting ?? "").slice(0, 280),
    intakeQuestions: Array.isArray(parsed.intakeQuestions)
      ? parsed.intakeQuestions.filter((s: unknown) => typeof s === "string").slice(0, 7)
      : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const placesKey =
      Deno.env.get("GOOGLE_PLACES_API_KEY") ||
      Deno.env.get("Maps_Platform_API_Key") ||
      Deno.env.get("MAPS_PLATFORM_API_KEY");
    if (!placesKey) {
      return new Response(JSON.stringify({ error: "Missing Google Places API key" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));

    // ---------- DETAILS MODE ----------
    if (body?.mode === "details") {
      const parsed = DetailsSchema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return await fetchDetails(parsed.data.place_id, placesKey);
    }

    // ---------- SEARCH MODE ----------
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { name, phone, city, state } = parsed.data;
    const phoneE164 = phone ? toE164(phone) : "";
    const phoneDigits = phone ? phone.replace(/\D/g, "") : "";

    const candidates: Array<{
      place_id: string;
      name: string;
      address: string;
      category: string;
      types: string[];
      rating: number | null;
      business_status?: string;
    }> = [];
    const seen = new Set<string>();

    // 1) Text Search when name is present
    if (name && name.length >= 2) {
      const query = [name, city, state].filter(Boolean).join(" ");
      const textUrl =
        `https://maps.googleapis.com/maps/api/place/textsearch/json` +
        `?query=${encodeURIComponent(query)}` +
        `&key=${encodeURIComponent(placesKey)}`;
      const r = await fetch(textUrl);
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.results)) {
          for (const p of d.results.slice(0, 12)) {
            if (!p.place_id || seen.has(p.place_id)) continue;
            seen.add(p.place_id);
            const types: string[] = Array.isArray(p.types) ? p.types : [];
            candidates.push({
              place_id: p.place_id,
              name: p.name ?? "",
              address: p.formatted_address ?? "",
              category: types[0] ?? "",
              types,
              rating: typeof p.rating === "number" ? p.rating : null,
              business_status: p.business_status,
            });
          }
        }
      } else {
        console.error("textsearch error", r.status, await r.text());
      }
    }

    // 2) Phone lookup (always tried when phone supplied — gives us a verified match to boost)
    let phoneMatchId: string | null = null;
    if (phoneE164) {
      const findUrl =
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=${encodeURIComponent(phoneE164)}` +
        `&inputtype=phonenumber` +
        `&fields=place_id,name,formatted_address,types,rating` +
        `&key=${encodeURIComponent(placesKey)}`;
      const r = await fetch(findUrl);
      if (r.ok) {
        const d = await r.json();
        const c = d?.candidates?.[0];
        if (c?.place_id) {
          phoneMatchId = c.place_id;
          if (!seen.has(c.place_id)) {
            seen.add(c.place_id);
            const types: string[] = Array.isArray(c.types) ? c.types : [];
            candidates.push({
              place_id: c.place_id,
              name: c.name ?? "",
              address: c.formatted_address ?? "",
              category: types[0] ?? "",
              types,
              rating: typeof c.rating === "number" ? c.rating : null,
            });
          }
        }
      } else {
        console.error("findplace error", r.status, await r.text());
      }
    }

    // Sort: phone-verified match first, then by rating desc
    candidates.sort((a, b) => {
      if (phoneMatchId) {
        if (a.place_id === phoneMatchId) return -1;
        if (b.place_id === phoneMatchId) return 1;
      }
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    const top = candidates.slice(0, 8);

    return new Response(JSON.stringify({
      found: top.length > 0,
      candidates: top,
      phone: phoneE164,
      phone_digits: phoneDigits,
      phone_matched_place_id: phoneMatchId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("business-lookup error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchDetails(placeId: string, placesKey: string): Promise<Response> {
  const detailsUrl =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=${encodeURIComponent(
        "place_id,name,formatted_address,formatted_phone_number,international_phone_number,opening_hours,types,website,rating",
      )}` +
      `&key=${encodeURIComponent(placesKey)}`;

    const detailsRes = await fetch(detailsUrl);
    if (!detailsRes.ok) {
      const text = await detailsRes.text();
      console.error("place details error", detailsRes.status, text);
    return new Response(JSON.stringify({ found: false, business: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const detailsData = await detailsRes.json();
    if (detailsData?.status !== "OK" || !detailsData?.result) {
      console.error("place details status", detailsData?.status, detailsData?.error_message);
    return new Response(JSON.stringify({ found: false, business: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const details = detailsData.result;
    const types: string[] = Array.isArray(details.types) ? details.types : [];
    const business = {
      business_name: details.name ?? "",
      address: details.formatted_address ?? "",
      phone:
        details.formatted_phone_number ??
        details.international_phone_number ??
      "",
      website: details.website ?? "",
      business_hours: Array.isArray(details.opening_hours?.weekday_text)
        ? details.opening_hours.weekday_text.join("\n")
        : "",
      types,
      category: types[0] ?? "",
      rating: typeof details.rating === "number" ? details.rating : null,
      place_id: details.place_id ?? placeId,
    };

    let suggestion: Awaited<ReturnType<typeof suggestWithAI>> | null = null;
    try {
      suggestion = await suggestWithAI({
        businessName: business.business_name || "this business",
        types: business.types,
        address: business.address,
      });
    } catch (e) {
      console.error("AI suggestion failed", e);
    }

  return new Response(JSON.stringify({ found: true, business, suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}