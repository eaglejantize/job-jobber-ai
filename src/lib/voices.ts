export type VoiceBadge = "Recommended" | "Most Human" | "Premium";

export type VoicePersona = {
  id: string;
  label: string;
  persona: string;
  badge?: VoiceBadge;
  description: string;
  previewUrl: string;
  voiceId: string;
};

export const VOICES: VoicePersona[] = [
  {
    id: "maya",
    label: "Maya",
    persona: "Recommended",
    badge: "Recommended",
    description: "Warm, natural, and professional. Best for most businesses.",
    previewUrl: "/audio/voices/maya-preview.mp3",
    voiceId: "placeholder-maya",
  },
  {
    id: "jasmine",
    label: "Jasmine",
    persona: "Most Human",
    badge: "Most Human",
    description: "Friendly and conversational. Feels relaxed and approachable.",
    previewUrl: "/audio/voices/jasmine-preview.mp3",
    voiceId: "placeholder-jasmine",
  },
  {
    id: "claire",
    label: "Claire",
    persona: "Premium",
    badge: "Premium",
    description: "Polished and corporate. Great for higher-end clients.",
    previewUrl: "/audio/voices/claire-preview.mp3",
    voiceId: "placeholder-claire",
  },
  {
    id: "marcus",
    label: "Marcus",
    persona: "Confident Technician",
    description: "Direct, knowledgeable, and steady. Feels like an experienced service pro.",
    previewUrl: "/audio/voices/marcus-preview.mp3",
    voiceId: "placeholder-marcus",
  },
  {
    id: "leo",
    label: "Leo",
    persona: "Fast",
    description: "Quick and efficient. Best for high call volume.",
    previewUrl: "/audio/voices/leo-preview.mp3",
    voiceId: "placeholder-leo",
  },
  {
    id: "ava",
    label: "Ava",
    persona: "Calm",
    description: "Reassuring and patient. Good for stressed or urgent callers.",
    previewUrl: "/audio/voices/ava-preview.mp3",
    voiceId: "placeholder-ava",
  },
  {
    id: "noah",
    label: "Noah",
    persona: "Calm Authority",
    description: "Calm, confident, and authoritative. Good for premium or commercial clients.",
    previewUrl: "/audio/voices/noah-preview.mp3",
    voiceId: "placeholder-noah",
  },
];

export const DEFAULT_VOICE_ID = "maya";

export function getVoiceById(id: string | null | undefined): VoicePersona {
  return VOICES.find((v) => v.id === id) ?? VOICES[0];
}

export function getVoiceByLabel(label: string | null | undefined): VoicePersona | undefined {
  if (!label) return undefined;
  return VOICES.find((v) => v.label.toLowerCase() === label.toLowerCase());
}