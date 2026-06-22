import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Generates a TTS preview using Lovable AI gateway's text-to-speech endpoint.
// Tone/speed are mapped to OpenAI TTS instructions + speed param.
// On any failure, returns audio_url:null so the client can fall back to the
// voice's stock previewUrl.

function speedNumber(speed: string): number {
  if (speed === "slow") return 0.85;
  if (speed === "fast") return 1.15;
  return 1.0;
}

function toneInstruction(tone: string): string {
  if (tone === "Professional") return "Speak in a calm, professional, polished tone.";
  if (tone === "Energetic") return "Speak in an energetic, upbeat, enthusiastic tone.";
  return "Speak in a friendly, warm, natural tone.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ audio_url: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? "Hi, thanks for calling. How can I help you today?").slice(0, 500);
    const tone = String(body.tone ?? "Friendly");
    const speed = String(body.speed ?? "normal");
    const voiceName = String(body.voice_name ?? "alloy").toLowerCase();
    // OpenAI TTS preset voices fallback set
    const TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
    const ttsVoice = TTS_VOICES.includes(voiceName) ? voiceName : "alloy";

    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: text,
        voice: ttsVoice,
        instructions: toneInstruction(tone),
        speed: speedNumber(speed),
        response_format: "mp3",
      }),
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ audio_url: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    // Encode as base64 data URL
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const audioUrl = `data:audio/mpeg;base64,${b64}`;
    return new Response(JSON.stringify({ audio_url: audioUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ audio_url: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
