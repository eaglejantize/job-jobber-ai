## Greeting Preview Feature

Add a "Preview Greeting" control next to the Greeting field so business owners can type a greeting, hear it aloud, adjust speaking rate, and insert SSML-style pauses.

### Where it appears
- **Setup wizard** — Step 5 ("Voice & Greeting") in `src/pages/Setup.tsx`, directly under the Greeting input.
- **Settings page** — Existing greeting editor in `src/pages/Settings.tsx`, same component reused.

### UI (new component `src/components/GreetingPreview.tsx`)
- **Greeting textarea** (controlled by parent; we replace the current single-line Field for greeting).
- **Pause inserter buttons**: "Short pause (300ms)", "Medium (600ms)", "Long (1s)". Each inserts `<break time="300ms"/>` etc. at the cursor position.
- **Speaking rate slider**: 0.7× – 1.2×, default 1.0× (matches Lovable AI TTS `speed` range).
- **Play / Stop button** with loading state.
- Helper text showing SSML example: `Thanks for calling <break time="300ms"/> Roofing Guy. How can I help you?`
- Plays MP3 returned from edge function via `<audio>` element.

### Backend — new edge function `supabase/functions/preview-greeting/index.ts`
- POST `{ text: string, speed: number, voiceId?: string }`.
- Auth: require Supabase JWT (verify with anon client, reject if no user) — preview is for signed-in users only to prevent abuse.
- Validate with Zod: text 1–500 chars, speed 0.7–1.2.
- Convert SSML-style `<break time="Xms"/>` (and `Xs`) tags into natural pause cues for the TTS model:
  - Strip the tags from the text sent to TTS.
  - Replace each break with proportional ellipses/commas (`,` for ≤300ms, `...` for ≤700ms, `... ...` for >700ms) since `openai/gpt-4o-mini-tts` does not parse SSML but does respect punctuation pauses.
- Call Lovable AI Gateway `POST https://ai.gateway.lovable.dev/v1/audio/speech` with:
  - `model: "openai/gpt-4o-mini-tts"`, `voice: "alloy"` (or mapped from voiceId), `speed`, `response_format: "mp3"`, no `stream_format` (one-shot file is simpler for preview ≤500 chars).
- Return raw `audio/mpeg` bytes; handle 402/429/500 with explicit error JSON.
- CORS headers; deploy via `supabase--deploy_edge_functions`.

### Client wiring
- `GreetingPreview` calls `supabase.functions.invoke("preview-greeting", { body: { text, speed } })` (set `responseType` via `fetch` directly, since `invoke` parses JSON — use `fetch` to `${VITE_SUPABASE_URL}/functions/v1/preview-greeting` with the user's access token, read blob, create object URL).
- Show toast on errors (out of credits, rate limit, etc.).

### Files changed
- **add** `src/components/GreetingPreview.tsx`
- **add** `supabase/functions/preview-greeting/index.ts`
- **edit** `src/pages/Setup.tsx` — replace single-line Greeting Field with `<GreetingPreview value={state.greeting} onChange={(v)=>set("greeting",v)} />`
- **edit** `src/pages/Settings.tsx` — replace the greeting textarea with `<GreetingPreview ... />` (keeping the existing style/manual-edit logic intact)

### Non-goals
- No persistent storage of audio previews.
- No per-break adjustable durations beyond the three preset buttons (users can still hand-edit `<break time="..."/>` values in the textarea).
- Voice selection stays where it already is; preview uses the currently selected voice.
