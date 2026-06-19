## Goal
Fix `vapi-webhook` so leads get linked to a client and the SMS alert fires with full lead details.

## Changes

### 1. `supabase/functions/vapi-webhook/index.ts` — rewrite client lookup + logging

- Add `console.log` statements at every step (event type, dialed number, lookup results, insert result, SMS dispatch result) prefixed `[vapi-webhook]` so they show up in edge function logs.
- Extract dialed assistant number from `event.phoneNumber.number` (fallbacks: `event.call.phoneNumber.number`, `event.call.phoneNumberId`, `event.call.to`, `event.to`).
- Client lookup order:
  1. `client_id` from `?client_id=` query or `metadata.client_id`.
  2. Match by dialed digits against `business_phone`, `assigned_callcapture_number`, `alert_phone` (normalized to digits — same approach as today but logged).
  3. **New fallback:** if no match and exactly one row exists in `callcapture_clients`, use that client_id.
- Log each step: which number was matched, which column hit, or "no client match — using single-client fallback" / "no client found".
- Expand `insertPayload` to also persist structured fields the SMS uses:
  - `service` ← `structured.service ?? structured.service_type`
  - `timing` ← `structured.timing ?? structured.appointment_preference`
  - `new_or_returning` ← `structured.new_or_returning`
  - `referral` ← `structured.referral ?? structured.how_heard`
  Keep existing fields (`name`, `phone`, `issue`, `urgency`, `address`, `summary`, `transcript`, `intake_answers`, `raw_payload`, `status`).

### 2. `supabase/functions/send-sms/index.ts` — richer SMS body

- Select the additional fields from the lead row: `name, phone, summary, issue, service, timing, new_or_returning, referral`.
- Build body lines (skip blanks):
  ```
  New {business_name} lead
  Name: {name}
  Phone: {phone}
  Service: {service ?? issue}
  When: {timing}
  Status: {new_or_returning}
  Heard via: {referral}
  ```
- Log Twilio response status + body with `[send-sms]` prefix so failures surface in logs.

### 3. Webhook → SMS invocation

- After successful insert, log `clientId` + `lead.id` and the SMS response status/body (await + read response instead of fire-and-forget) so we can see in `vapi-webhook` logs whether send-sms succeeded.

## Out of scope
Inbox, AI settings, `update-vapi-agent`, schema migrations. Plan assumes the new structured columns referenced (`service`, `timing`, `new_or_returning`, `referral`) already exist on `callcapture_leads` (confirmed via existing `LeadCard.tsx` typing — the table has `new_or_returning`, `timing`, `referral`, etc.). `service` falls back to `issue` if the column is absent.
