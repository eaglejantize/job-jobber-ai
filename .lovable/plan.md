## Problem

Confirmed: the most recent lead has `client_id = NULL`. The Vapi webhook isn't receiving a `client_id` (no `?client_id=` on the server URL and no `metadata.client_id` on the call), so leads are inserted unlinked, and the inbox (which filters strictly by `client_id`) shows nothing.

## Fix

### 1. `supabase/functions/vapi-webhook/index.ts` — resolve `client_id` server-side

Add a phone-based fallback before insert:
- If no `client_id` from query/metadata, look up the dialed number on the Vapi event (`event.phoneNumber.number`, `event.call.phoneNumber.number`, or `event.call.to`).
- Match it against `callcapture_clients.assigned_callcapture_number`, then `business_phone`, then `alert_phone` (normalize to digits-only for comparison).
- Insert the resolved id into `client_id`. If still unresolved, insert with `NULL` (as today) so SMS path is unaffected.

SMS flow is untouched — it already runs only when `clientId` is set, and we set it before sending.

### 2. `src/pages/LeadInbox.tsx` — debug fallback + visibility

- Resolve current client by `user_id` first, then fall back to `email` match against `callcapture_clients.email` (lowercased) so users created before the auth link still find their row.
- Add a temporary "Show unlinked leads" toggle (default on) that also fetches `WHERE client_id IS NULL` and merges them in. Render an amber "Unlinked" badge on those cards. Add a small note explaining this is a debug view.
- Pass `client_id` into `LeadCard` so it can render the id for debugging.

### 3. `src/components/LeadCard.tsx`

- Extend `Lead` type with `client_id: string | null`.
- Render `client_id` (or "unlinked") as a small monospace line under the header for debugging.

### 4. Backfill

Run an UPDATE that backfills `client_id` on existing `callcapture_leads` rows where it is null, matching by `phone` against the same three client phone columns. This will surface the current test lead in the inbox immediately.

### 5. Note for follow-up (not done now)

Once a real lead lands with a proper `client_id`, the user can ask us to remove the IS NULL fallback from the inbox. We'll leave a `TODO` comment in `LeadInbox.tsx` marking the block to delete.

## Out of scope

- `send-sms` and the rest of the SMS flow.
- Admin panel, /start, Stripe.
