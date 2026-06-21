## Problem

Test calls reach the webhook and the lead row is created with `transcript` + `phone`, but every other column is empty. Root cause: Vapi is returning `analysis.structuredData = {}` (no schema attached to the assistant), so the webhook has nothing to write into `name`, `address`, `treatment`, `timing`, etc.

## Fix — LLM extraction fallback in `vapi-webhook`

Edit `supabase/functions/vapi-webhook/index.ts`:

1. After resolving `clientId` and computing `structured` from Vapi, check whether structured is empty (or missing key fields) AND a `transcript` is available.
2. If so, call Lovable AI Gateway (`google/gemini-3-flash-preview`) with a strict extraction prompt that returns JSON with:
   - `name`, `phone`, `address`, `issue`, `urgency`, `treatment` (service), `type`, `timing` (appointment preference), `new_or_returning`, `referral`, `summary`
3. Robust parse: strip code fences, `JSON.parse` in a try/catch, log failures, never throw.
4. Merge: prefer Vapi `structured` values when present, fall back to LLM-extracted values. Phone falls back to the caller number we already have.
5. Build `insertPayload` from the merged object (same columns as today).
6. Keep all existing logging, client lookup, UPDATE-client-id, and `send-sms` invocation untouched.

Uses existing `LOVABLE_API_KEY` secret. No schema changes, no frontend changes, no touching `update-vapi-agent` / AI Settings, no Vapi tool wiring (deferred per the user — that's the "Vapi schema later" half).

## Verification

- Use `supabase--curl_edge_functions` to POST a synthetic end-of-call payload with the captured transcript from the screenshot.
- Query `callcapture_leads` to confirm `name`, `address`, `treatment`, `timing`, etc. are populated.
- Inbox card should now show all fields.

## Out of scope

- `update-vapi-agent`, AI Settings, Vapi `structuredDataSchema` / `submitIntake` tool attachment (the "later" half of the chosen approach).
- Inbox UI changes.
- `send-sms` body.
