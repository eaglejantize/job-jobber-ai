## Why test calls produce no data

I traced the pipeline. Four root causes:

1. **No per-tenant Vapi assistant exists.** `provision-twilio-number` registers the Twilio number to "the first Vapi assistant whose name loosely matches the business" (or just `list[0]`). Sub-accounts end up sharing one assistant, or pointing at an unrelated one.
2. **Vapi was never told where to send webhooks.** The phone-number registration omits `serverUrl` and `assistantOverrides`, and we never `PATCH` the assistant with a `server.url`. So end-of-call reports, transcripts, and status updates never reach `vapi-webhook` → no rows are written anywhere.
3. **No tenant metadata travels with the call.** `place-test-call` sends only `phoneNumberId` + `assistantId` + `customer.number`. Even if a webhook fired, the tenant link would be guesswork.
4. **`vapi-webhook` never creates a lead or fires an SMS.** It writes a call row + transcript turns on `end-of-call-report`, but never inserts into `callcapture_leads` and never calls `send-sms`, so the inbox and alerts stay empty even when call data lands.

## What I'll change

### A. Provisioning writes a tenant-bound assistant + webhook (`provision-twilio-number`)
- Create/upsert a dedicated Vapi assistant for the client (`POST /assistant`) using the client's greeting, voice, industry, intake questions. Persist its id on `callcapture_clients.vapi_assistant_id` (new column).
- Register the Twilio number with that assistant *and* set:
  - `server.url = <SUPABASE_URL>/functions/v1/vapi-webhook`
  - `server.secret = VAPI_WEBHOOK_SECRET`
  - `assistantOverrides.metadata = { client_id, user_id }`
  - `serverMessages = ["status-update","transcript","end-of-call-report","conversation-update"]`
- Persist on `callcapture_clients`: `tenant_id` (= user_id), `twilio_phone_number_sid`, `vapi_phone_number_id`, `vapi_assistant_id`, `assigned_callcapture_number`, `webhook_status`.

### B. Test call carries tenant context (`place-test-call`)
- Resolve the client's own `vapi_phone_number_id` + `vapi_assistant_id` from the DB instead of scanning all Vapi numbers.
- Pass `metadata: { client_id, user_id, test_call: true }` and `assistantOverrides.serverMessages` on the outbound call.
- Insert a `callcapture_calls` row immediately with `status='queued'`, `client_id=<tenant>`, `vapi_call_id=<returned>`, `is_test=true`.

### C. Webhook routes everything to the right tenant (`vapi-webhook`)
Tenant resolution order (first hit wins, all logged):
1. `call.metadata.client_id`
2. `phoneNumberId` → `callcapture_clients.vapi_phone_number_id`
3. Called number → `callcapture_clients.assigned_callcapture_number`
4. `assistantId` → `callcapture_clients.vapi_assistant_id`

On `end-of-call-report`:
- Update the call row.
- Run the existing transcript-LLM extraction.
- **Insert `callcapture_leads`** scoped to `client_id` with name/phone/service/intake.
- Pull `callcapture_clients.alert_phone` + `notification_settings`, then invoke `send-sms` with the lead summary. Never fall back to the super-admin number.
- Write a `callcapture_webhook_events` row for every step (new table).

### D. New diagnostics table + super-admin panel
- Migration: `callcapture_webhook_events(id, client_id, vapi_call_id, step, status, detail jsonb, created_at)`. Steps: `received`, `tenant_matched`, `call_started`, `transcript_received`, `call_ended`, `lead_extracted`, `lead_created`, `sms_sent`, `sms_failed`.
- `vapi-webhook` writes one row per step with the resolved `client_id` (or null + reason).
- New super-admin page section "Webhook diagnostics" listing the latest 100 events with tenant + step + status.

### E. "Test Call Result" panel
- After `place-test-call` returns, poll `callcapture_webhook_events` for the new `vapi_call_id` (or subscribe via realtime) and render a checklist:
  - Call received • Tenant matched • Transcript saved • Lead created • SMS sent
- Each failed step shows the captured error from the diagnostics row.

### F. Hard guardrails
- Webhook refuses to write to `client_id = super admin` for calls flagged `is_test` or originating from a tenant's `vapi_phone_number_id` — if resolution lands on the super-admin row, log `tenant_mismatch` and bail.
- `send-sms` invocation always uses the resolved tenant's `alert_phone`; super-admin `DEMO_OWNER_PHONE` is no longer a fallback inside this flow.

### Migration (single file)
```sql
ALTER TABLE callcapture_clients
  ADD COLUMN IF NOT EXISTS vapi_assistant_id text,
  ADD COLUMN IF NOT EXISTS webhook_status text;

CREATE TABLE public.callcapture_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.callcapture_clients(id) ON DELETE SET NULL,
  vapi_call_id text,
  step text NOT NULL,
  status text NOT NULL,           -- ok | error | skipped
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.callcapture_webhook_events TO authenticated;
GRANT ALL ON public.callcapture_webhook_events TO service_role;
ALTER TABLE public.callcapture_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant reads own webhook events"
  ON public.callcapture_webhook_events FOR SELECT TO authenticated
  USING (public.owns_client(client_id) OR public.is_current_user_super_admin());
```

## Out of scope / unchanged
- Twilio search/purchase flow, SMS flow itself, signup, billing bypass.
- Existing leads written by `submit-intake` continue to work; the new lead write in `vapi-webhook` is additive and de-duped by `vapi_call_id`.

## Open question before I build

Some existing tenants already have a Twilio number provisioned but no per-tenant Vapi assistant or webhook configured. Want me to add a one-click **"Repair routing"** button on the admin row that re-runs assistant creation + Vapi registration + webhook wiring for that tenant? (Otherwise existing tenants will need to re-provision.)
