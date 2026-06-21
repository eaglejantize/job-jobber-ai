import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function ssmlToPunctuation(input: string): string {
  // Replace <break time="Xms"/> or <break time="Xs"/> with pause punctuation
  return input.replace(/<break\s+time=["']?(\d+)(ms|s)["']?\s*\/?>/gi, (_m, n, unit) => {
    const ms = unit === "s" ? Number(n) * 1000 : Number(n);
    if (ms <= 300) return ", ";
    if (ms <= 700) return "... ";
    return "... ... ";
  }).replace(/<[^>]+>/g, ""); // strip any other tags
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const speed = Math.min(1.2, Math.max(0.7, Number(body?.speed) || 1.0));
    const voice = typeof body?.voice === "string" && body.voice ? body.voice : "alloy";

    if (!text || text.length > 800) {
      return new Response(JSON.stringify({ error: "text must be 1-800 chars" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const spoken = ssmlToPunctuation(text);

    const ttsRes = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: spoken,
        voice,
        speed,
        response_format: "mp3",
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => "");
      let msg = `TTS failed (${ttsRes.status})`;
      if (ttsRes.status === 402) msg = "AI credits exhausted. Add credits to continue.";
      else if (ttsRes.status === 429) msg = "Rate limited. Try again in a moment.";
      return new Response(JSON.stringify({ error: msg, detail: errText.slice(0, 300) }), {
        status: ttsRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audio = await ttsRes.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});