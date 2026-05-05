
# Automated CallCapture Number Provisioning

Replace the `(XXX) XXX-XXXX` placeholder with a real Twilio-backed search → reserve flow that saves the assigned number to the customer's account.

## 1. Database — add provisioning columns to `callcapture_clients`

Migration adds:

- `phone_mode` text (`new` / `existing` / `test`)
- `preferred_area_code` text
- `assigned_callcapture_number` text (E.164)
- `twilio_phone_number_sid` text
- `number_status` text (`active`, `needs_configuration`, `failed`)
- `number_provisioned_at` timestamptz
- `business_phone` text (for "use existing" mode)

No RLS changes — existing `own client` policies cover reads/updates by `auth.uid() = user_id`.

## 2. Edge functions (Twilio connector gateway)

Twilio is already wired as a connector — the gateway handles auth, no new secrets needed. Both functions deploy with `verify_jwt = false` and validate the JWT in code via `getClaims`.

### `search-twilio-numbers`
- Input: `{ area_code: string }`
- Validates `area_code` is 3 digits.
- `GET https://connector-gateway.lovable.dev/twilio/AvailablePhoneNumbers/US/Local.json?AreaCode=XXX&SmsEnabled=true&VoiceEnabled=true&PageSize=5`
- Returns `[{ phone_number, friendly_name, locality, region }]` (up to 5).
- Falls back to `NearNumber` search if zero results.

### `provision-twilio-number`
- Input: `{ phone_number: string, client_id: string }`
- Auth: `getClaims`, verify caller owns `client_id`.
- `POST .../IncomingPhoneNumbers.json` with `PhoneNumber=<E.164>`.
  - Voice/SMS webhook URLs are set if `VAPI_INBOUND_URL` / project SMS function URL exist; otherwise omitted.
- On success: update `callcapture_clients` row with `assigned_callcapture_number`, `twilio_phone_number_sid`, `number_status='active'` (or `needs_configuration` if webhooks weren't wired), `number_provisioned_at=now()`, `phone_mode='new'`.
- On Twilio error: return `{ error }` with Twilio's message; do NOT mutate DB. Client shows error and lets user pick another number.

## 3. Setup wizard — Phone Setup step

Inside the existing `mode === "new"` panel in `src/pages/Setup.tsx`:

```
[ Preferred area code: 904 ]   [ Find Available Numbers ]

After search:
  ┌──────────────────────────┐  ┌──────────────────────────┐
  │ (904) 555-0142           │  │ (904) 555-0188           │
  │ Jacksonville, FL         │  │ Jacksonville, FL         │
  │ [ Select Number ]        │  │ [ Select Number ]        │
  └──────────────────────────┘  └──────────────────────────┘

After selecting:
  Selected: (904) 555-0142
  [ Reserve This Number ]   [ Pick a different one ]

After reserving (success):
  ✓ Your CallCapture number: (904) 555-0142
  Status: Active
```

State is local to the step plus persisted to wizard state via new fields (`assignedCallcaptureNumber`, `twilioPhoneNumberSid`, `numberStatus`). On reserve success, also writes to `callcapture_clients` immediately (so dashboard reflects it without waiting for "Generate"). If purchase fails, show inline error; user can retry or pick another.

`mode === "existing"` and `mode === "test"` keep their current behavior (no Twilio call). On final "Generate My AI Receptionist", `phone_mode`, `preferred_area_code`, `business_phone` are persisted to the client row alongside the already-saved provisioned number.

## 4. Settings — Phone Setup section

Same Search → Select → Reserve UI added to the existing `phoneMode === "new"` block in `src/pages/Settings.tsx`. If a number is already assigned, show it with status badge and a "Release & pick a new number" link (releases via Twilio `DELETE` on the SID, clears DB fields).

## 5. Dashboard

In the Status / Call Setup cards (`src/pages/Dashboard.tsx`):

- Pull `assigned_callcapture_number`, `number_status` from `callcapture_clients`.
- Show **CallCapture Number** with E.164 formatted display.
- Show **Number Status** badge (`Active` green, `Needs Configuration` amber, `—` when unset).
- Add `[ Edit Phone Setup ]` button → links to `/settings#phone`.

## 6. Safety / non-breakage

- No changes to login, leads inbox, Stripe, Vapi webhooks, demo number, voice picker, or SMS edge function.
- `verify_jwt = false` for both new functions, with in-code JWT validation.
- Twilio call failures never block wizard progression for `existing` / `test` modes.
- All Twilio writes happen server-side only.

## Files touched

- `supabase/functions/search-twilio-numbers/index.ts` (new)
- `supabase/functions/provision-twilio-number/index.ts` (new)
- `supabase/config.toml` (add `verify_jwt = false` for both)
- New migration: add columns to `callcapture_clients`
- `src/pages/Setup.tsx` — search/select/reserve UI in PhoneSetupStep
- `src/pages/Settings.tsx` — same UI in Phone tab
- `src/pages/Dashboard.tsx` — display assigned number + status + Edit Phone Setup
- `src/lib/wizardSchema.ts` — add `twilioPhoneNumberSid`, `numberStatus`

Approve to implement.
