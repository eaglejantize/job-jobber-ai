import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({}));
    const businessName = String(body.business_name ?? "");
    const category = String(body.category ?? "");
    const hours = String(body.hours ?? "");
    const address = String(body.address ?? "");

    const sys = `You configure an AI phone receptionist for small service businesses.
Return ONLY a JSON object with this exact shape, no commentary, no markdown:
{"greeting":"<short under 30 words>","after_hours_message":"<short under 30 words>","services":["s1","s2","s3","s4","s5"]}
The greeting mentions the business name and is friendly+natural.
The after-hours message politely says we're closed and someone will call back.
Services are 4-8 short common services for the business category.`;

    const user = `Business: ${businessName}\nCategory: ${category}\nHours: ${hours}\nAddress: ${address}`;

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
      const txt = await r.text();
      return new Response(JSON.stringify({ error: `AI ${r.status}: ${txt}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = String(raw).replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return new Response(
      JSON.stringify({
        greeting: String(parsed.greeting ?? "").slice(0, 400),
        after_hours_message: String(parsed.after_hours_message ?? "").slice(0, 400),
        services: Array.isArray(parsed.services)
          ? parsed.services.filter((s: unknown) => typeof s === "string").slice(0, 10)
          : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
