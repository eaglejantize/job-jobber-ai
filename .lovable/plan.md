## Add "Test Your AI Receptionist" section to Dashboard

Insert a new interactive Voice & Test card on `/dashboard`, placed right after the existing "Quick Actions" block and before "Recent Leads" — so the existing layout, status row, and leads list remain untouched.

### Section structure

**Header**
- Title: "Test Your AI Receptionist"
- Subtext: "Call or listen to your assistant before going live."
- Right-side badge: 🟢 "Live — Calls Active" (green pill, only shown when `setup_status === "Live"`; otherwise neutral "Setup in progress")

**Part 1 — Voice Selection (4 cards in a responsive grid)**
Selectable voice cards (radio-style, click to select):
- Riley — Friendly Female
- Morgan — Professional Female
- Jesse — Friendly Male
- Cameron — Professional Male

Selected card gets primary border + ring. Selection persists in `localStorage` under `callcapture.selectedVoice`.

**Part 2 — Voice Preview**
Each voice card has a "▶ Play Sample" button. Clicking it:
- Plays a short greeting sample (5–10 s) using the assistant's greeting + tone
- Uses ElevenLabs TTS via a new edge function `voice-sample` (returns MP3 bytes), with the appropriate ElevenLabs voice ID per option
- Button toggles to "⏸ Stop" while playing; only one sample can play at a time
- Falls back gracefully with a toast if `ELEVENLABS_API_KEY` is missing

**Part 3 — Test Call**
- Label: "Your AI Phone Number"
- Display the user's `businessPhone` (from `callcapture_businesses.phone`) if set; otherwise the `DEMO_NUMBER` with a small "(demo)" tag
- Button: "Call My AI" → `tel:` link
- Button: "Copy Number" → writes to clipboard + success toast

**Part 4 — Guided Test Mode**
- Switch labeled "Guided Test Mode" (off by default)
- When ON, reveal a soft-bordered panel with example prompts:
  - "My dryer isn't heating"
  - "I need service tomorrow"
  - "This is a recall job"
- State persists in `localStorage`

### Files to add / change

- **New** `supabase/functions/voice-sample/index.ts` — POST `{ voiceId, text }` → returns `audio/mpeg` bytes from ElevenLabs (`eleven_turbo_v2_5`, `mp3_44100_128`). Reads `ELEVENLABS_API_KEY` from secrets. CORS-enabled. `verify_jwt = false` not required (will use default).
- **New** `src/components/dashboard/VoiceTestSection.tsx` — Self-contained component containing all five parts above. Uses existing UI primitives: `Card`, `Button`, `Switch`, `Badge`, plus `useToast`. Fetches sample audio via `supabase.functions.invoke("voice-sample", { body: { voiceId, text } })`, converts the returned `Blob` to an object URL, plays it through a single `HTMLAudioElement` ref.
- **Edit** `src/pages/Dashboard.tsx` — Import and render `<VoiceTestSection businessPhone={phoneToShow} businessName={client?.business_name} status={status} />` between the Quick Actions card and Recent Leads card. No other changes.

### Secrets

If `ELEVENLABS_API_KEY` is not yet configured in Lovable Cloud, request it via `add_secret` before deploying the edge function. Without it, the play button falls back to a toast: "Voice preview unavailable — add an ElevenLabs API key to enable samples."

### Voice IDs (per the ElevenLabs guide)

- Riley (Friendly Female) → Sarah `EXAVITQu4vr4xnSDxMaL`
- Morgan (Professional Female) → Alice `Xb7hH8MSUJpSbSDYk0k2`
- Jesse (Friendly Male) → Liam `TX3LPaxmHKxFdv7VOQHJ`
- Cameron (Professional Male) → Brian `nPczCjzI2devNBz1zQrb`

### Sample text used for preview

```text
Thanks for calling {businessName || "our team"}, this is {voiceName}. How can I help you today?
```

### What stays untouched

- Setup flow, wizard steps, auth, routing, existing dashboard cards (Status, Quick Actions, Recent Leads, Request Setup banner) all remain exactly as they are.
- No DB schema changes.
