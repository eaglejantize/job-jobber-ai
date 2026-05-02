## Plan: Add Lead Inbox storage to CallCapture

Goal: every successful Vapi webhook call sends the SMS (existing behavior, unchanged) AND persists a lead row. Minimal, stable, no CRM UI.

### 1. New table `callcapture_leads` (migration)

```sql
CREATE TABLE public.callcapture_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  phone       text,
  issue       text,
  type        text,        -- "New Lead" or "Existing Customer"
  urgency     text,        -- stored as text per spec (e.g. "true"/"false"/"high")
  address     text,
  raw_payload jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.callcapture_leads ENABLE ROW LEVEL SECURITY;
```

RLS: the edge function writes via the service role key, which bypasses RLS, so no INSERT policy is needed for the webhook. To keep the table locked down (no public read/write) we add **no policies** — anon/auth clients get nothing. If/when a Lead Inbox UI is built later, we'll add an owner-scoped SELECT policy then.

### 2. Update `supabase/functions/send-demo-sms/index.ts`

Changes (additive only — SMS path untouched):

- Extend `extractFromVapi` to also pull `address` (`sd.address`, `body.address`, `m.customer?.address`).
- Loosen `PayloadSchema` to accept optional `address` (string, max ~300).
- After Twilio returns `200`, insert a row into `callcapture_leads` using the service-role Supabase client:
  - `name`, `phone`, `issue`, `type`, `urgency` (coerced to string: `String(urgency ?? "")` — keeps "true"/"false"/"high" etc.), `address`, `raw_payload: raw` (the full incoming JSON body).
- Wrap insert in try/catch. **Never fail the request if DB insert fails** — SMS already sent, just log.
- Logging:
  - Success: `console.log("lead inserted", { id, phone })`
  - Failure: `console.error("lead insert failed", error.message)` (no payload contents)
- Response stays the same shape; optionally add `leadId` when insert succeeds (non-breaking).

Client used in the function:
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);
```

Both env vars already exist in the project (see secrets list).

### 3. Verification

After deploy, re-run the existing curl tests (flat payload + Vapi-nested payload). For each:
- Confirm SMS still sends (Twilio SID returned).
- Query `select id, name, phone, type, urgency, address, created_at from callcapture_leads order by created_at desc limit 5;` and confirm rows landed with correct fields and `raw_payload` populated.
- Send one bad-DB scenario isn't really reachable, but verify the function still returns 200 even if we simulate a DB hiccup (covered by try/catch design).

### Out of scope

- No UI / Lead Inbox page (spec says "do NOT build a full CRM").
- No changes to auth, RLS for client reads, or Vapi schema.
- No update to existing tables.

### Files touched

- New migration: `callcapture_leads` table + RLS enable.
- `supabase/functions/send-demo-sms/index.ts`: add address extraction, schema field, post-SMS insert with logging.

Approve to implement.