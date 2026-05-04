# Launch Fix Pass — CallCapture MVP

Five focused fixes. No DB changes. No changes to auth, Stripe, Vapi, Twilio, SMS, or assistant prompt generation.

## 1. Smart "Call Demo" button (mobile = call, desktop = copy)

Create `src/components/CallDemoButton.tsx`:
- Detect mobile via `matchMedia('(pointer: coarse)')` + UA fallback (`/Android|iPhone|iPad|iPod|Mobile/i`).
- On mobile: render `<a href="tel:+19048927004">` (uses `DEMO_NUMBER_TEL`).
- On desktop: render `<button>` that calls `navigator.clipboard.writeText(DEMO_NUMBER)` then `toast({ title: "Demo number copied", description: DEMO_NUMBER })`.
- Forwards `className`, `size`, `variant`, and children so it drops into existing layouts.
- Default label: `<><Phone /> Call the Demo</>` but accepts children override.

Replace every "Call the Demo" trigger that currently uses `<a href={tel:}>`:
- `src/components/DemoNumberCard.tsx` (CTA button + the big number link stays as-is since clicking the number on mobile is fine; convert the CTA button only).
- `src/pages/Index.tsx` (hero CTA, final CTA — 2 spots).
- `src/pages/Dashboard.tsx` "Test My Agent" button.

Keep raw `<a href="tel:">` links inside text (e.g. inline phone link in Index "Try It Live" copy) — those are fine.

## 2. Phone setup — three clear options (Setup wizard + Settings)

Update `src/lib/wizardSchema.ts`:
- Add fields: `preferredAreaCode: string`, `businessPhone: string`, `assignedCallcaptureNumber: string`.
- `phoneMode` already exists (`new | existing | test`). Keep as-is.
- Default values empty strings.

Update `src/pages/Setup.tsx` `PhoneSetupStep`:
- Rewrite the three options with the exact required copy:
  - **A. Get a new CallCapture number** — input "Preferred area code"; show placeholder card "We'll assign this during setup" with a sample number; saves `preferredAreaCode` + `assignedCallcaptureNumber` (the placeholder).
  - **B. Use my existing business number** — input "Current business phone number"; helper text "You'll forward missed calls to your AI receptionist"; saves `businessPhone`.
  - **C. Test mode for now** — copy: "Use the demo number while setup is being finalized"; no input.
- Keep the existing `phone`/`phoneNumber` fields synced for backward compat with `generateAndFinish` (mirror chosen value into `state.phone`).
- Validation in `next()` updated to use the new fields per mode.

Add the same UI block to `src/pages/Settings.tsx` Phone tab (above the existing "How Your Calls Are Handled" section). Persist into `callcapture_assistant_configs.call_rules` JSONB:
```ts
call_rules: {
  ...callRules,
  phone_mode,
  preferred_area_code,
  business_phone,
  assigned_callcapture_number,
}
```
And mirror `business_phone` into `callcapture_businesses.phone` for back-compat.

## 3. Rename "Leads" → "Inbox"

- `src/components/AppNav.tsx`: change link label `"Leads"` → `"Inbox"` (route stays `/leads`, no DB rename).
- `src/pages/LeadInbox.tsx`: page title → `"Call Inbox"`, subtitle → `"Captured calls and customer requests appear here."`
- `src/pages/Dashboard.tsx`: "Recent Leads" heading and the `/leads` link label "View all" stays, but rename heading "Recent Leads" → "Recent Inbox" (kept consistent with new nav).

## 4. Homepage "Hear CallCapture in Action" section

Add new section in `src/pages/Index.tsx` immediately after the "Try It Live" section:
- Title: "Hear CallCapture in Action"
- Subtext: "Listen to a real-style service call handled by the AI receptionist."
- `<audio controls src="/audio/demo/full-demo-call.mp3" onError={…}>` — on error, replace with text "Demo call recording will be added shortly." Use a small React state `audioMissing` toggled by `onError` handler.
- Below: shadcn `Accordion` (single, collapsible) titled "Read the call transcript" containing the provided 6-line transcript with bold speaker labels.

No new audio files are committed (the path is just referenced; missing file shows fallback).

## 5. Voice previews

Confirmed: `src/lib/voices.ts` already points each voice to `/audio/voices/<id>-preview.mp3` for maya/jasmine/claire/marcus/leo/ava/noah — matches required paths exactly. **No change needed.**

`src/components/VoicePicker.tsx` already keeps the Play Preview button visible at all times and shows a toast on missing audio (`onerror` + `play().catch`). **No change needed.**

## Files touched

- `src/components/CallDemoButton.tsx` (new)
- `src/components/DemoNumberCard.tsx`
- `src/pages/Index.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/LeadInbox.tsx`
- `src/components/AppNav.tsx`
- `src/lib/wizardSchema.ts`
- `src/pages/Setup.tsx`
- `src/pages/Settings.tsx`

## Out of scope (not breaking)

- Database schema unchanged (new phone fields persist into existing `call_rules` JSONB).
- No edge function, Stripe, Twilio, Vapi, auth, or SMS changes.
- Voice files and the `/audio/demo/full-demo-call.mp3` file are not added in this pass — UI handles missing files gracefully.

Approve to implement.
