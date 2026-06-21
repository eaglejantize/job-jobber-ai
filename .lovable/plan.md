## Goal

Remove the unfinished TTS preview (returning 400) and replace it with a "Place Test Call" button that triggers a real outbound Vapi call using the currently-saved assistant, greeting, voice, and industry settings — so business owners hear the live production voice experience.

Out of scope: intake extraction, SMS alerts, lead creation, call routing.

## Changes

### 1. New edge function `supabase/functions/place-test-call/index.ts`

- POST `{ client_id, to_number }`, JWT-authenticated (verify owner or super admin, mirroring `update-vapi-agent`).
- Validate `to_number` is E.164 (Zod).
- Load `callcapture_clients` row to get `assigned_callcapture_number` / `business_phone`, `business_name`, `greeting`, `voice_id`, `industry`.
- Look up the matching Vapi `phoneNumberId` and `assistantId` via `GET https://api.vapi.ai/phone-number` (same matching logic as `update-vapi-agent`).
- Place the call: `POST https://api.vapi.ai/call` with
  ```json
  {
    "phoneNumberId": "<vapi phone id>",
    "assistantId": "<vapi assistant id>",
    "customer": { "number": "<to_number>" }
  }
  ```
- `console.log` (visible in edge logs): `assistantId`, `voice_id`, `greeting`, `to_number`, full Vapi response.
- Return `{ ok, callId, assistantId, voiceId, greeting, to: to_number, vapi }` or `{ ok: false, error, vapi }` on failure.
- Deploy via `supabase--deploy_edge_functions`.

Note: the assistant on Vapi already holds the saved greeting/voice/prompt (kept in sync by `update-vapi-agent` on save), so the test call automatically uses the current business name, greeting, voice, and industry settings.

### 2. New component `src/components/TestCallButton.tsx`

- "Place Test Call" button.
- On click, opens a small dialog with a phone number input (default to the owner's phone if available) and a Call button.
- Calls `supabase.functions.invoke("place-test-call", { body: { client_id, to_number } })`.
- Status display states: `Calling…` → `Connected` → `Completed` / `Failed`.
  - `Calling…` while the invoke promise is pending.
  - On success response, switch to `Connected` (Vapi returns immediately once the call is dialing).
  - Poll `GET https://api.vapi.ai/call/{id}` via a tiny passthrough? Out of scope — instead show `Completed` after a short delay or when user dismisses, and `Failed` if invoke errors. (Live status updates beyond the initial dial would require a Vapi webhook subscription; not in scope.)
- Show a collapsible "Details" block with: Assistant ID, Voice ID, Greeting used, Destination number, raw Vapi response.

### 3. Wire into Settings + Setup

- `src/components/settings/AiSettingsPanel.tsx`: remove `<GreetingPreview>` import/usage, restore a plain `<Textarea>` for the greeting, and render `<TestCallButton clientId={c.id} defaultTo={ownerPhone} />` next to it. Add a small "Live preview coming soon — use Test Call to hear the real voice" hint.
- `src/pages/Setup.tsx`: same swap — `<Textarea>` for greeting + `<TestCallButton>` (only enabled once the client row is saved and a number is assigned; otherwise show disabled with tooltip "Save and assign a number first").

### 4. Cleanup

- Delete `src/components/GreetingPreview.tsx`.
- Delete `supabase/functions/preview-greeting/` and remove its `[functions.preview-greeting]` block from `supabase/config.toml`.

## Technical notes

- Authentication: reuse `update-vapi-agent` auth pattern (Bearer JWT, owner-or-super-admin check via `callcapture_clients`).
- Vapi call API ref: https://docs.vapi.ai/api-reference/calls/create
- All Vapi response and request metadata is logged server-side; the UI surfaces a summary so the user can verify which assistant/voice/greeting was used.
- No DB schema changes. No new secrets (uses existing `VAPI_API_KEY`).
