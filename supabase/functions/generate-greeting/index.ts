import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { business_name, industry, tone, include_business_name } = await req.json();
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Write 3 short, natural-sounding phone greetings (under 18 words each) for an AI receptionist.
Business: ${business_name || "this business"}
Industry: ${industry || "service business"}
Tone: ${tone || "Friendly"}
${include_business_name ? "Include the business name." : "Do not include the business name."}
Return ONLY a JSON array of 3 strings, no commentary. Example: ["Greeting 1","Greeting 2","Greeting 3"]`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return new Response(JSON.stringify({ error: text }), {
        status: r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content ?? "[]";
    let options: string[] = [];
    try {
      const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) options = parsed.filter((s) => typeof s === "string").slice(0, 3);
    } catch {
      options = raw.split("\n").filter((l: string) => l.trim()).slice(0, 3);
    }

    return new Response(JSON.stringify({ options }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});