import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const FALLBACK = [
  { id: "jasmine", provider_voice_id: "jasmine", name: "Jasmine", provider: "elevenlabs", description: "Warm, friendly female", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3" },
  { id: "marcus", provider_voice_id: "marcus", name: "Marcus", provider: "elevenlabs", description: "Confident, professional male", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7c65fe4d-1b6c-46f4-9e63-9b32a7d6d1ed.mp3" },
  { id: "claire", provider_voice_id: "claire", name: "Claire", provider: "elevenlabs", description: "Calm, articulate female", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/942356dc-f10d-4d89-bda5-4f8505ee038e.mp3" },
  { id: "nova", provider_voice_id: "nova", name: "Nova", provider: "elevenlabs", description: "Bright, upbeat female", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3" },
  { id: "james", provider_voice_id: "james", name: "James", provider: "elevenlabs", description: "Deep, reassuring male", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3" },
  { id: "luna", provider_voice_id: "luna", name: "Luna", provider: "elevenlabs", description: "Soft, soothing female", previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("VAPI_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ voices: FALLBACK, source: "fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const r = await fetch("https://api.vapi.ai/voice", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) throw new Error(`Vapi ${r.status}`);
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data?.voices ?? data?.data ?? []);
    const voices = list.slice(0, 60).map((v: Record<string, unknown>) => ({
      id: String(v.id ?? v.voiceId ?? v.voice_id ?? v.name ?? crypto.randomUUID()),
      provider_voice_id: String(v.id ?? v.voiceId ?? v.voice_id ?? v.name ?? ""),
      name: String(v.name ?? v.voiceId ?? v.id ?? "Voice"),
      provider: String(v.provider ?? "vapi"),
      description: String(v.description ?? v.accent ?? v.gender ?? ""),
      previewUrl: (v.previewUrl ?? v.preview_url ?? v.sampleUrl ?? null) as string | null,
    }));
    if (voices.length === 0) throw new Error("empty");
    return new Response(JSON.stringify({ voices, source: "vapi" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ voices: FALLBACK, source: "fallback", error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});