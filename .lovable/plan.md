## Diagnosis

- Step 4 button calls `provision-vapi-number`, which buys numbers through Vapi. Recent edge logs show Vapi rejecting requested area codes ("This area code is currently not available. Hint: Try 385, 405, 573."), which surfaces as the generic non-2xx error.
- A Twilio-based flow already exists (`search-twilio-numbers`, `provision-twilio-number`) but is not wired into the wizard. It uses the Lovable Twilio **connector gateway** (`LOVABLE_API_KEY` + `TWILIO_API_KEY`), so we do not need `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` secrets — those are managed by the connector.
- After purchase, no Voice/SMS webhooks are set on the Twilio number, and the number is never registered with Vapi as the AI agent's inbound number.
- Step 1 (Google Business Lookup) can hard-fail and block setup.

## Goal

Switch number provisioning to Twilio (with proper fallbacks and webhook wiring), keep Vapi only as the AI voice brain, and make the Google lookup non-blocking.

## Backend changes

1. **`search-twilio-numbers`**
   - Return `numbers` for the requested area code.
   - If empty, retry with `InRegion=<state>` (derived from client address) or no area filter and return `nearby: [...]` plus `fallback_reason`.
   - Map Twilio errors to specific codes: `missing_secret`, `twilio_auth_failed` (401/403), `no_numbers`, `twilio_error`.

2. **`provision-twilio-number`** (replaces the Vapi path used by the button)
   - Purchase from Twilio (existing logic).
   - Immediately PATCH the number with:
     - `VoiceUrl` → Vapi inbound TwiML endpoint for this client's assistant
     - `SmsUrl` → `${SUPABASE_URL}/functions/v1/vapi-webhook?kind=sms` (or a new `twilio-sms-webhook` if needed)
   - Register the purchased number with Vapi (`POST /phone-number` with `provider: "twilio"`, `twilioAccountSid`, `twilioAuthToken` from the connector gateway equivalent, `assistantId`) so the AI flow answers it. If Vapi rejects, mark `number_status='needs_configuration'` and return a clear error — do NOT silently succeed.
   - Save `assigned_callcapture_number`, `twilio_phone_number_sid`, `vapi_phone_number_id`, `number_status='active'`.
   - Granular error envelope: `{ error_code, message, details? }`.

3. **New `link-existing-number`** edge function for the fallbacks:
   - `mode: "byo"` — store user-supplied number, mark `phone_mode='byo'`, `number_status='pending_forwarding'`, return forwarding instructions.
   - `mode: "forward"` — same as byo but flag `forwarding_configured=false` until verified.
   - `mode: "test"` — assign a shared demo Twilio number from `DEMO_FORWARD_NUMBER` secret with `number_status='test'` and a 7-day expiry.

4. **Delete** `provision-vapi-number` (or keep but no longer called).

5. **Secrets audit**: confirm `TWILIO_API_KEY` (connector), `LOVABLE_API_KEY`, `VAPI_API_KEY`. If the Vapi Twilio import requires raw Account SID/Auth Token, request them via `add_secret` only after confirming the connector gateway cannot proxy that import.

## Frontend changes

1. **`PhoneNumberPicker.tsx`** rebuilt as a 3-tab flow:
   - **Tab A — Get a new Vektuor number (Twilio)**
     1. Enter area code → call `search-twilio-numbers`.
     2. Render up to 5 candidates; if none, render `nearby` list with a banner "No numbers in {areaCode}, here are nearby options".
     3. User picks one → call `provision-twilio-number` with `phone_number` + `client_id`.
     4. Inline error toasts mapped from `error_code`.
   - **Tab B — I already have a number** → form, calls `link-existing-number` `mode=byo`.
   - **Tab C — Forward my current number** → form + step-by-step carrier forwarding instructions, calls `mode=forward`.
   - **Tab D — Use a temporary test number** → one-click, calls `mode=test`.

2. **`Step3PhoneNumber`** in `src/setup/steps.tsx`
   - Gate "Next" on `data.assigned_callcapture_number && data.number_status in ('active','pending_forwarding','test')`.
   - Show current status badge.

3. **`Step1FindBusiness`** in `src/setup/steps.tsx`
   - Catch all errors from `business-lookup`; never block. Always show "Skip and enter manually" as a primary action when lookup fails or returns 0 results.
   - Errors render as a dismissible inline note, not a toast that traps the user.

## Data model

`callcapture_clients` already has `assigned_callcapture_number`, `twilio_phone_number_sid`, `number_status`, `phone_mode`, `number_provisioned_at`. Add (migration):
- `vapi_phone_number_id text`
- `forwarding_from_number text`
- `number_test_expires_at timestamptz`

## Out of scope

- Background queue worker. Twilio purchase + webhook config completes well within the 60s edge-function budget; we'll keep it synchronous and revisit only if we hit timeouts.
- SMS Pumping Protection / Geo Permissions configuration (recommend to user, not auto-enabled).

## Validation

- `curl_edge_functions` test each function with valid/invalid input.
- Manually run Step 4 in preview with a real area code, a known-empty area code (to exercise nearby fallback), and each fallback tab.
- Verify the purchased number has `VoiceUrl` set in Twilio and shows up in Vapi's phone numbers list.
