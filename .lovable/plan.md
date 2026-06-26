# ServanaHQ Integration + Test Call Tenant Routing

## 1. Database

Migration on `callcapture_clients`:
- `servanahq_enabled boolean default false`
- `servanahq_account_id text`
- `servanahq_endpoint_url text` (optional override; defaults to global base URL)

Add new step type to `callcapture_webhook_events.step` (text column — no enum change needed). New step names:
- `servanahq_check`, `servanahq_mapping`, `servanahq_payload`, `servanahq_request`, `servanahq_response`, `servanahq_synced`, `servanahq_failed`

Add `servanahq_lead_id text` and `servanahq_synced_at timestamptz` to `callcapture_leads` for traceability.

## 2. Secret

Add global `SERVANAHQ_API_KEY` via `add_secret` (also optional `SERVANAHQ_BASE_URL`, defaulting to `https://api.servanahq.com/v1` until user confirms real endpoint).

## 3. Edge Functions

**New: `supabase/functions/sync-servanahq/index.ts`**
- Input: `{ client_id, lead_id }`
- Loads client + lead with service role
- Logs `servanahq_check` (enabled? account_id present?)
- If disabled → log + exit (not a failure)
- Logs `servanahq_mapping` with account_id
- Builds payload: `{ account_id, source:'vektuor', name, phone, email, address, service, timing, notes, transcript_url }`
- Logs `servanahq_payload`
- POSTs to `${SERVANAHQ_BASE_URL}/leads` with `Authorization: Bearer SERVANAHQ_API_KEY`
- Logs `servanahq_request` then `servanahq_response` with status + body
- On 2xx: updates lead with `servanahq_lead_id`, logs `servanahq_synced`
- On non-2xx: logs `servanahq_failed` with reason; returns error but does not throw

**Modify: `supabase/functions/vapi-webhook/index.ts`**
- After successful lead insert + SMS send, invoke `sync-servanahq` (fire-and-forget via `supabase.functions.invoke`) passing `client_id` + `lead_id`. Wrap in try/catch so it never blocks core pipeline.

**Modify: `supabase/functions/place-test-call/index.ts`**
- Require explicit `client_id`, `user_id`, `vapi_assistant_id`, `vapi_phone_number_id` in the body (from caller)
- Reject if `client_id` is missing OR client is super_admin tenant (return 400 `"Select a tenant"`)
- Pass `metadata: { client_id, user_id, is_test: true }` to Vapi
- Pre-insert `callcapture_calls` row scoped to that tenant with `is_test=true`
- Remove any default/fallback that resolves to the super admin or first client

## 4. Frontend

**`src/components/TestCallButton.tsx`** — major refactor:
- Two new selects above the phone input:
  - Tenant select (queries `callcapture_clients where is_super_admin = false` ordered by name)
  - Vektuor number select (queries `vapi_phone_number_id` + `twilio_number` for chosen tenant; disabled until tenant chosen)
- Disable "Place Test Call" until tenant + number + destination phone are valid
- Pass `client_id, user_id, vapi_assistant_id, vapi_phone_number_id` into `place-test-call`
- Extend the **Test Call Result checklist** (polls `callcapture_webhook_events` filtered by `client_id` + recent timeframe):
  1. Call received
  2. Tenant resolved
  3. Transcript captured
  4. **Vektuor lead created** (`lead_created`)
  5. **SMS alert sent** (`sms_sent`)
  6. **ServanaHQ lead synced** (`servanahq_synced`, `servanahq_failed`, or `servanahq_check` disabled → shows "Not connected")
- Each row shows status icon + last log message; failures expand to show the logged `reason`.

**`src/pages/Admin.tsx`**:
- TestCallButton is rendered only in admin context with the tenant picker (remove any prior placements that defaulted to current user)
- Add **"Impersonate Tenant"** action per row: opens a new tab to `/dashboard?impersonate=<client_id>` with a signed JWT-style param handled by a small `useImpersonation` hook that overrides the `client_id` used by Dashboard / LeadInbox queries (super-admin gated). Persist in sessionStorage and add a banner "Viewing as <tenant>" with "Exit Impersonation".

**ServanaHQ settings panel** (new `src/components/ServanaHqSettings.tsx`):
- Toggle "Connect ServanaHQ"
- Input "ServanaHQ Account ID"
- Optional "Custom endpoint URL"
- Saves to `callcapture_clients`
- Mounted in `Setup.tsx` (CRM step) and in `Settings`/AI Settings tab

## 5. Removing super-admin leakage

Audit and remove any fallback that routes calls/leads to super admin:
- `vapi-webhook`: keep the 4-tier resolver (metadata → number id → called number → assistant id) but **delete** the "fallback to single client / super_admin" branch. If unresolved, log `tenant_unresolved` and stop — do not insert a row.
- `place-test-call`: described above.
- `TestCallButton`: never falls back to current user when on Admin page.

## 6. Diagnostics surfacing

`Admin.tsx` Diagnostics tab already streams `callcapture_webhook_events`. Add filter chips for the new ServanaHQ step types and color rows red on `servanahq_failed` / `tenant_unresolved`.

## Open items to confirm during build
- Real ServanaHQ base URL + request shape (currently stubbed to `/v1/leads`); will request from user before flipping `servanahq_enabled` on for production tenants.
- Whether "Impersonate Tenant" should mint a real auth session (requires service-role `admin.generateLink`) or just a read-only client-side override. Plan defaults to read-only override; can upgrade later.
