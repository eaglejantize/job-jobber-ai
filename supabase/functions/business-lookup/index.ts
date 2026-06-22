import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const INDUSTRY_LABELS = [
  "HVAC","Plumbing","Electrical / Electrician","Appliance Repair","Auto Repair",
  "General Contractor","Roofing","Landscaping / Lawn Care","Cleaning Services",
  "Pest Control","Pool & Spa Service","Garage Door Service","Locksmith",
  "Moving & Hauling","Med Spa / Aesthetics","Dental Office","Salon / Barber",
  "Fitness / Personal Training","Law Firm","Accounting / Bookkeeping",
  "Real Estate","Property Management","Auto Dealership","Other",
];

const LABEL_TO_VALUE: Record<string, string> = {
  "HVAC":"hvac","Plumbing":"plumbing","Electrical / Electrician":"electrical",
  "Appliance Repair":"appliance_repair","Auto Repair":"auto_repair",
  "General Contractor":"general_contractor","Roofing":"roofing",
  "Landscaping / Lawn Care":"landscaping","Cleaning Services":"cleaning",
  "Pest Control":"pest_control","Pool & Spa Service":"pool_spa",
  "Garage Door Service":"garage_door","Locksmith":"locksmith",
  "Moving & Hauling":"moving","Med Spa / Aesthetics":"med_spa",
  "Dental Office":"dental","Salon / Barber":"salon",
  "Fitness / Personal Training":"fitness","Law Firm":"law_firm",
  "Accounting / Bookkeeping":"accounting","Real Estate":"real_estate",
  "Property Management":"property_mgmt","Auto Dealership":"auto_dealership",
  "Other":"other",
};

const BodySchema = z.object({ phone: z.string().min(7).max(30) });

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
    industry_value: LABEL_TO_VALUE[label] ?? "other",
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
      Deno.env.get("GOOGLE_PLACES_API_KEY") ??
      Deno.env.get("VITE_GOOGLE_PLACES_API_KEY");
    if (!placesKey) {
      return new Response(JSON.stringify({ error: "Missing GOOGLE_PLACES_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const phoneE164 = toE164(parsed.data.phone);

    // Legacy Google Places: Find Place from Phone Number → Place Details
    const findUrl =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(phoneE164)}` +
      `&inputtype=phonenumber` +
      `&fields=place_id` +
      `&key=${encodeURIComponent(placesKey)}`;

    const findRes = await fetch(findUrl);
    if (!findRes.ok) {
      const text = await findRes.text();
      console.error("find place error", findRes.status, text);
      return new Response(JSON.stringify({ error: "places_lookup_failed", detail: text }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const findData = await findRes.json();
    const placeId = findData?.candidates?.[0]?.place_id;

    if (!placeId || (findData?.status && findData.status !== "OK")) {
      console.log("no place found", findData?.status, findData?.error_message);
      return new Response(JSON.stringify({ found: false, business: null, phone: phoneE164 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ found: false, business: null, phone: phoneE164 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const detailsData = await detailsRes.json();
    if (detailsData?.status !== "OK" || !detailsData?.result) {
      console.error("place details status", detailsData?.status, detailsData?.error_message);
      return new Response(JSON.stringify({ found: false, business: null, phone: phoneE164 }), {
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
        phoneE164,
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

    return new Response(JSON.stringify({ found: true, business, suggestion, phone: phoneE164 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("business-lookup error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});