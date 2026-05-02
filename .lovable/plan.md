Fix three UX issues in Settings → AI Settings voice picker.

## 1. VoicePicker (`src/components/VoicePicker.tsx`)
- Remove the swap that hides "Play Preview" when audio fails. Always render the button.
- On audio error, fire `toast("Preview audio not uploaded yet.")` (sonner) and reset playing state. Button stays clickable.
- Remove `disabled` from the Select button. Selected state shows "Selected" + check icon with primary variant; non-selected shows "Select Voice". Border highlight stays.
- Drop the unused `errorIds` set; track only `playingId`.

## 2. Settings AI tab (`src/pages/Settings.tsx`)

**Voice section header**
- Add a small "Reset to Recommended" ghost button next to the "Voice" label. Calls `selectVoice(getVoiceById(DEFAULT_VOICE_ID))` (Maya).

**Receptionist name field**
- Replace the generic `Field` usage with inline JSX:
  - Label: "What should your receptionist say their name is?"
  - Helper text under label: "Customers may hear this name during calls. You can use the selected voice name or choose your own."
  - Input bound to `cfg.assistant_name`. On user typing, set `nameManuallyEdited = true`.
  - Adjacent secondary button "Use selected voice name" → sets `assistant_name` to the currently selected voice's label and clears `nameManuallyEdited`.

**Auto-sync name with voice**
- Add `nameManuallyEdited` state (default false; also false on initial load if name matches a known voice label or is empty).
- In `selectVoice(v)`: update `notification_settings.voice` AND, if `!nameManuallyEdited` and current name is empty or matches any voice label (case-insensitive), set `assistant_name` to `v.label`.

## 3. Save behavior
`saveAi` already persists `assistant_name` and `notification_settings.voice` (label, persona, preview URL, voice_id). No changes required.

## Out of scope
Dashboard, Leads, Auth, Stripe, Twilio, Vapi, edge functions, DB schema, wizard, other Settings tabs.
