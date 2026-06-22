## Goal

One canonical 8-step Setup flow, rendered two ways:
- **Onboarding** (`/setup`): full-page guided walkthrough, one step per screen, with explanations and a progress bar.
- **In-app Settings** (`/settings`): same steps shown as compact accordion cards, each independently editable and saved on its own.

Both read/write the exact same row in `callcapture_clients` (+ `callcapture_assistant_configs` for prompt/script). All fields start blank — no super-admin leakage.

## Shared architecture

New files:
- `src/lib/setupSchema.ts` — single Zod schema covering all 8 steps (replaces `wizardSchema.ts`).
- `src/lib/setupDefaults.ts` — returns an empty defaults object (no env/admin reads).
- `src/setup/` — one component per step, each accepting `{ value, onChange, onSaveStep }`:
  - `Step1FindBusiness.tsx`
  - `Step2BusinessDetails.tsx`
  - `Step3PhoneNumber.tsx` (wraps existing `PhoneNumberPicker` flow)
  - `Step4Voice.tsx`
  - `Step5Script.tsx`
  - `Step6CallHandling.tsx`
  - `Step7Notifications.tsx`
  - `Step8Review.tsx`
- `src/setup/SetupContainer.tsx` — wizard chrome (stepper, Back/Next) used by `/setup`.
- `src/setup/SetupAccordion.tsx` — accordion chrome used by `/settings`.
- `src/setup/useSetupData.ts` — load/save hook against `callcapture_clients` (+ assistant config).

Rewrite:
- `src/pages/Setup.tsx` → renders `SetupContainer`.
- `src/pages/Settings.tsx` → renders `SetupAccordion`.

Removed/legacy: `src/components/settings/PhoneSetupWizard.tsx`, `AiSettingsPanel.tsx`, `src/lib/wizardSchema.ts`, `src/pages/Onboarding.tsx`, `src/pages/Start.tsx` (consolidated into `/setup`).

## Step-by-step behavior

### Step 1 — Find your business
- Single phone input → calls existing `business-lookup` edge function (Google Places). Extend it to return name, address, formatted phone, hours, category, website, rating.
- Result card with "Yes, that's my business" / "Edit details" / "Search again".
- On confirm: map Google fields into Step 2; call new edge function `ai-prefill-setup` (Lovable AI Gateway, Gemini 3 Flash) to generate `greeting`, `after_hours_message`, `services[]`, `transfer_triggers[]`, `call_rules` based on name + category + hours.
- Show banner: "We found your business! We've pre-configured your AI receptionist…".
- "Skip / enter manually" link continues with empty form.

### Step 2 — Business details
Fields (all empty unless populated by Step 1): business_name, owner_name, business_phone, address, industry (6-option dropdown: Appliance Repair, HVAC, Plumbing, Electrical, General Home Services, Other), website, business_hours_schedule (Mon-Sun open/close + Closed toggle), timezone.

### Step 3 — Your Vektuor number
Reuses `PhoneNumberPicker` → `provision-vapi-number`. Placeholder: "Enter preferred area code e.g. 305". Shows provisioned number on success, friendly message on empty inventory. Saves `assigned_callcapture_number`, `number_status='active'`.

### Step 4 — Voice
- Lists voices from existing `list-vapi-voices` edge function as selectable cards (name, gender, description).
- Controls: tone toggle (Professional/Friendly/Energetic), speed slider (Slow/Normal/Fast), `rings_before_answer` selector (1-4).
- "Play Sample" button per card: calls new edge function `vapi-voice-sample` which requests a TTS preview from Vapi with the current tone/speed and returns an audio URL; plays inline.

### Step 5 — Script
- Greeting textarea pre-filled from Step 1 AI generation (or empty).
- "AI Rewrite" — prompt input → calls `ai-rewrite-greeting` edge function with current greeting + instruction.
- "Preview" — calls `vapi-voice-sample` with current voice + script.
- "Reset to Default" — regenerates from business data.
- Separate fields: `after_hours_message`, services list (add/remove chips), FAQs list (question/answer pairs).

### Step 6 — Call handling & forwarding
- `forward_phone` input.
- `voicemail_fallback` toggle.
- After-hours behavior radio: voicemail / forward / ai_handles → mapped to existing `answer_after_hours` + new `after_hours_mode` column.

### Step 7 — SMS & notifications
- SMS toggle + notification phone (defaults blank).
- Email toggle.
- Multi-select: New call / New booking / Missed call / All activity.
Stored in `notification_settings` jsonb.

### Step 8 — Review & launch
- Sections for each prior step with Edit button (jumps to that step in wizard, expands that accordion in settings).
- Onboarding: "Launch My AI Receptionist" → persists, calls `update-vapi-agent` with full config (incl. `rings_before_answer`), shows success screen with provisioned number.
- Settings: no launch button; each section saves on its own.

## Data model (one migration)

Additions to `callcapture_clients`:
- `owner_name text`, `services text[]`, `faqs jsonb`, `voice_speed text`, `after_hours_mode text` (voicemail|forward|ai), `after_hours_message text`, `notification_settings jsonb`, `google_place_id text`, `google_rating numeric`.

Additions to `callcapture_assistant_configs`: none — reuse `greeting`, `tone`, `intake_questions`, `call_rules`, `notification_settings`, `generated_prompt`. Insert one row per client on launch.

GRANTs preserved (existing table). RLS policies already scope by `user_id = auth.uid()` — no super-admin readback. The new `ai-prefill-setup`, `ai-rewrite-greeting`, `vapi-voice-sample` edge functions validate caller via JWT before doing anything.

## Edge functions

- New: `ai-prefill-setup`, `ai-rewrite-greeting`, `vapi-voice-sample`.
- Extend: `business-lookup` to return the full set of fields above.
- Reuse as-is: `provision-vapi-number`, `list-vapi-voices`, `update-vapi-agent`.

## Anti-leak guardrails

- `setupDefaults.ts` returns all empty strings — no reading from `auth.user().email`, no super-admin queries.
- `useSetupData` only `SELECT … WHERE user_id = auth.uid()` (relies on RLS).
- Wizard never falls back to "current session email" for `email`/`alert_phone`/etc.

## Out of scope

- Stripe checkout changes (kept as-is at end of onboarding).
- Vapi assistant assignment logic beyond `update-vapi-agent` (already exists).
- Lead inbox, dashboard, admin pages.

## Technical notes

- `rings_before_answer` is already a column; ensure it's included in the `update-vapi-agent` payload as `numberE164Settings.fallbackDestination`? — actually applied as Vapi assistant `endCallFunctionEnabled`/`silenceTimeoutSeconds` mapping; we'll pass it through unchanged on the assistant `server` config (current function already supports a `rings` field — will verify when implementing and add the field if missing).
- Voice preview uses Vapi `/tts` if available; otherwise the function returns a pre-recorded sample URL from `list-vapi-voices` with a note that tone/speed only applies on live calls.
- Mobile-first: each step renders in a single column with `max-w-xl`; review accordion uses `Accordion` from shadcn.
