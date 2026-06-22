## Problem
Onboarding's phone provisioning currently runs through Twilio (`search-twilio-numbers` + `provision-twilio-number`), even though the product uses Vapi-managed numbers (existing example: +1 904 893-3328). When a subaccount enters an area code, the Twilio path either returns no inventory or fails silently, so no number lands on the subaccount record.

We'll route provisioning through Vapi's number-buy endpoint instead, save the returned number to the subaccount, and surface clear success/empty-state messaging.

## Vapi flow
Vapi exposes `POST https://api.vapi.ai/phone-number` with:

```json
{ "provider": "vapi", "numberDesiredAreaCode": "904", "name": "<business name>" }
```

Auth: `Authorization: Bearer $VAPI_API_KEY` (already in project secrets). Response includes `id`, `number` (E.164), and `status`. If no inventory exists in that area code Vapi returns a 400 with a message we can map to the friendly copy.

## Changes

### 1. New edge function `supabase/functions/provision-vapi-number/index.ts`
- Auth: require `Authorization` bearer, validate via `getClaims`.
- Input: `{ area_code: "###", client_id: "<uuid>" }` (Zod-validated; area code must be 3 digits).
- Verify caller owns `callcapture_clients.id = client_id` (`user_id = sub`).
- Call Vapi `POST /phone-number` with `provider: "vapi"`, `numberDesiredAreaCode`, and `name` from the client's `business_name`.
- On Vapi 400 / "no numbers" style response → return `{ error: "No numbers available in that area code. Please try a different one." }` with HTTP 409.
- On success: update `callcapture_clients` with `assigned_callcapture_number = number`, `twilio_phone_number_sid = vapi id` (existing column, reused as provider id), `number_status = "active"`, `number_provisioned_at = now()`, `phone_mode = "new"`.
- Return `{ phone_number, id, status: "active", message }`.
- Standard CORS headers + JSON helper. Logs Vapi error bodies for debugging.

### 2. `src/components/PhoneNumberPicker.tsx`
- Replace the two-step Twilio search/reserve UI with a single "Get my Vektuor number" action that calls `provision-vapi-number` with `{ area_code, client_id }`.
- Remove `search-twilio-numbers` invocation and the results grid (Vapi assigns directly from area code).
- Map the 409 / "No numbers available" response to the exact friendly message requested and show it inline + via toast; keep the form so users can try another area code.
- On success, call `onProvisioned(phone, id, "active")` and render the existing "Your Vektuor number" card; the Active badge will show because status is `active`.
- Keep area code placeholder "Preferred area code" (already in place).

### 3. Leave Twilio functions and DB columns in place
- `search-twilio-numbers` / `provision-twilio-number` stay on disk but are no longer invoked from onboarding (admin/settings paths untouched). No DB migration required — we reuse `assigned_callcapture_number`, `twilio_phone_number_sid`, `number_status`, `number_provisioned_at`, `phone_mode`.

## Out of scope
- Wiring the new Vapi number to an assistant / inbound webhook (separate concern; status is already set to `active` as requested).
- Settings page phone management (`PhoneSetupWizard`) — only the onboarding picker is in scope.
- Any change to `callcapture_clients` schema or RLS.

## Files
- add `supabase/functions/provision-vapi-number/index.ts`
- edit `src/components/PhoneNumberPicker.tsx`
