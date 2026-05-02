// Placeholder Vapi voice catalog. These map to Vapi's supported providers/voices.
// We don't generate audio client-side — Vapi handles TTS at call time.

export type VapiVoiceOption = {
  id: string;            // internal id used in our UI
  displayName: string;   // friendly name shown to user (e.g. "Riley")
  toneLabel: string;     // tone descriptor (e.g. "Friendly Female")
  provider: "vapi" | "11labs" | "playht" | "azure";
  voiceId: string;       // provider-specific voice id (sent to Vapi as voice.voiceId)
  tone: "Friendly" | "Professional" | "Warm" | "Direct";
};

// These are sensible defaults using Vapi's built-in voice providers.
// Provider/voiceId pairs can be swapped without changing the UI.
export const VAPI_VOICES: VapiVoiceOption[] = [
  {
    id: "riley",
    displayName: "Riley",
    toneLabel: "Friendly Female",
    provider: "vapi",
    voiceId: "Neha",
    tone: "Friendly",
  },
  {
    id: "morgan",
    displayName: "Morgan",
    toneLabel: "Professional Female",
    provider: "vapi",
    voiceId: "Paige",
    tone: "Professional",
  },
  {
    id: "jesse",
    displayName: "Jesse",
    toneLabel: "Friendly Male",
    provider: "vapi",
    voiceId: "Cole",
    tone: "Friendly",
  },
  {
    id: "cameron",
    displayName: "Cameron",
    toneLabel: "Professional Male",
    provider: "vapi",
    voiceId: "Harry",
    tone: "Professional",
  },
];

export const DEFAULT_VAPI_VOICE_ID = "riley";

const STORAGE_KEY = "callcapture.voiceSelection";
const GUIDED_KEY = "callcapture.guidedTestMode";

export type StoredVoiceSelection = {
  selected_voice_id: string;       // our internal id (e.g. "riley")
  selected_voice_provider: VapiVoiceOption["provider"];
  selected_provider_voice_id: string; // provider-specific id sent to Vapi
  selected_tone: VapiVoiceOption["tone"];
};

export function loadVoiceSelection(): StoredVoiceSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredVoiceSelection;
      if (VAPI_VOICES.some((v) => v.id === parsed.selected_voice_id)) return parsed;
    }
  } catch {
    /* ignore */
  }
  const def = VAPI_VOICES.find((v) => v.id === DEFAULT_VAPI_VOICE_ID) ?? VAPI_VOICES[0];
  return {
    selected_voice_id: def.id,
    selected_voice_provider: def.provider,
    selected_provider_voice_id: def.voiceId,
    selected_tone: def.tone,
  };
}

export function saveVoiceSelection(voice: VapiVoiceOption) {
  const payload: StoredVoiceSelection = {
    selected_voice_id: voice.id,
    selected_voice_provider: voice.provider,
    selected_provider_voice_id: voice.voiceId,
    selected_tone: voice.tone,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadGuidedTestMode(): boolean {
  try {
    return localStorage.getItem(GUIDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveGuidedTestMode(on: boolean) {
  try {
    localStorage.setItem(GUIDED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
