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
    const current = String(body.current ?? "");
    const instruction = String(body.instruction ?? "").slice(0, 500);
    const businessName = String(body.business_name ?? "");
    const category = String(body.category ?? "");

    const sys = `You rewrite short AI phone receptionist greetings.
Return ONLY a JSON object: {"greeting":"<rewritten greeting, under 35 words>"}.
Keep it natural, mention the business name, follow the instruction.`;
    const user = `Business: ${businessName}\nCategory: ${category}\nCurrent greeting: ${current}\nInstruction: ${instruction}`;

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
      JSON.stringify({ greeting: String(parsed.greeting ?? "").slice(0, 400) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
