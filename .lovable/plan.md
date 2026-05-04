# Launch Fix Pass — Final Cleanup

Verification of the previous fix pass shows almost everything is already done:

- Smart `CallDemoButton` exists and is wired into `Index`, `Dashboard`, `DemoNumberCard`.
- Phone Setup three-mode flow exists in `Setup.tsx` (`PhoneSetupStep`) and `Settings.tsx` (`phone_mode`, `preferred_area_code`, etc. persisted to `call_rules`).
- Dashboard heading already says "Recent Inbox".
- Homepage "Hear CallCapture in Action" section + transcript accordion exists in `Index.tsx`.
- Voice preview file paths in `voices.ts` already match `/audio/voices/<id>-preview.mp3`; `VoicePicker` shows fallback toast and keeps Play button visible.

## Remaining gaps

Two small inconsistencies versus the spec:

1. `src/components/AppNav.tsx` — nav link label is still `"Leads"`. Change to `"Inbox"` (route `/leads` unchanged).
2. `src/pages/LeadInbox.tsx` — page heading is `"Lead Inbox"` and subtext is `"Every call your assistant captures shows up here, newest first."`
   - Change heading to `"Call Inbox"`.
   - Change subtext to `"Captured calls and customer requests appear here."`

## Out of scope / unchanged

- No DB renames.
- No changes to auth, Stripe, Vapi, Twilio, SMS, edge functions.
- No new audio files; missing-file fallbacks already handled.

Approve to apply the two label/title edits.
