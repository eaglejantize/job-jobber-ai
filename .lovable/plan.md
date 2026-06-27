# Root cause

The webhook chain is breaking at **step 1: tenant resolution**, which cascades into every downstream notification being skipped.

## What the logs show (call ended 2026‑06‑27 02:45:41 UTC)

The vapi-webhook **did** receive the post-call data. Each event was logged:

```
received           ok       (status-update, transcript, conversation-update, end-of-call-report)
tenant_matched     ERROR    matchedBy: none
                            phoneNumberId: 1b023a8a-5769-4b29-98b0-e86c91bea2a9
                            assistantId:   05941684-9bec-4122-8c83-d16a57bd0376
                            calledNumber:  null
lead_extracted     ok       (Gemini parsed: name "Ellis in Wonderland", service "leaking tank", timing "afternoon")
lead_created       SKIPPED  reason: no_tenant
sms_sent           SKIPPED  reason: no_tenant
```

So:
1. Webhook received the data ✅
2. **No row was created** in `callcapture_calls` or `callcapture_leads` for this call — skipped because no tenant
3. `bookSlot` was never invoked by the AI during the call (no tool-call events in the transcript) — separate issue from notifications
4. `alert_phone` on `Eaglejantize@gmail.com` is already set to `+13027473683` ✅
5. `send-sms` was never called — skipped at `lead_created` stage
6. `send-transactional-email`/`send-customer-sms` were never called — they only fire on bookings, and no booking occurred

## Why tenant resolution failed

The webhook tries to match in 4 ways:
1. `metadata.client_id` — Vapi did not surface our metadata in the end-of-call payload (we set it in `place-test-call` but it didn't echo back on the field we read)
2. `vapi_phone_number_id` — **the eaglejantize client row has this column NULL**, so `1b023a8a-…` matches nothing
3. `assigned_callcapture_number` vs `calledNumber` — `calledNumber` is null in payload
4. `vapi_assistant_id` — **also NULL on the eaglejantize row**, so `05941684-…` matches nothing

Even if any match had succeeded, the row is `is_super_admin = true`, and the webhook **explicitly nulls `clientId` for super-admin rows** ("safety: never write to super admin row for tenant calls"). So for the owner's own account, every test call is guaranteed to be dropped.

# Fix

## 1. Persist the Vapi IDs on the eaglejantize tenant

Update the row so `phoneNumberId` resolution succeeds on subsequent calls:

```sql
UPDATE callcapture_clients
SET vapi_phone_number_id = '1b023a8a-5769-4b29-98b0-e86c91bea2a9',
    vapi_assistant_id    = '05941684-9bec-4122-8c83-d16a57bd0376'
WHERE id = '7020a651-f4c4-46f4-8383-a4d9aea4925a';
```

## 2. Allow super-admin tenants to receive their own test-call data

In `supabase/functions/vapi-webhook/index.ts`, remove the hard-null of `clientId` when the matched row is `is_super_admin`. The block exists to prevent stray inbound calls from being attributed to the admin, but it also kills the admin's own test calls. Replace with: keep the match if it came from `metadata.client_id`, `vapi_phone_number_id`, or `vapi_assistant_id` (these are owner-specific), and only null it for the wide `assigned_callcapture_number` fallback.

## 3. Strengthen metadata extraction (so the primary path actually works)

`place-test-call` sets `metadata: { client_id, user_id, test_call }` on the Vapi call. Add fallback paths in the webhook to read it from:
- `message.call.metadata`
- `message.call.assistantOverrides.metadata`
- `message.metadata`
- `message.artifact.metadata`

Log the raw metadata blob (truncated) on the `received` event so we can see exactly what Vapi sends back next time.

## 4. Verify the SMS chain end-to-end

Once tenant resolves, `send-sms` runs with:
- `alert_phone` = `+13027473683` ✅
- `TWILIO_FROM_NUMBER`, `TWILIO_API_KEY`, `LOVABLE_API_KEY` all configured ✅

The owner SMS will fire on every completed call with a lead — no booking required. Customer SMS and confirmation emails only fire when a booking is created.

## 5. Note on bookSlot (separate, not blocking notifications)

The AI didn't call the `bookSlot` tool during these tests, so customer SMS + emails wouldn't fire even with tenant resolution fixed. That's a Vapi assistant-config issue (tools/system-prompt not yet pushed to assistant `05941684-…`). I'll flag it after notifications are confirmed; fixing the chain above will at minimum get **owner SMS** working on the next test call.

# Verification

After the fix, place one test call and confirm:
- `callcapture_webhook_events` shows `tenant_matched ok` (`matchedBy: vapi_phone_number_id` or `metadata`)
- A row appears in `callcapture_calls` and `callcapture_leads` for the call
- `sms_sent ok` event logged
- Owner phone receives the SMS

# Files touched

- SQL migration: backfill `vapi_phone_number_id` + `vapi_assistant_id` on the eaglejantize row
- `supabase/functions/vapi-webhook/index.ts`: scope the super-admin block + add metadata fallbacks + log raw metadata
