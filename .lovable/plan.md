## What the pipeline logs show

I traced call `019f1bc4-7343-7000-af81-78ac0e837515` through `callcapture_webhook_events`:

1. Vapi **did** send every webhook (`status-update`, multiple `transcript`, `conversation-update`, `end-of-call-report`) — reachability is fine.
2. The Edge Function received them all and ran without exceptions.
3. Lead extraction from transcript **succeeded** (Robert Blackson, 9043338826, "leaking", etc.).
4. Every event logged `tenant_matched = error` with `matchedBy: none`.
5. Because no tenant was resolved, `lead_created` → `skipped (no_tenant)`, `sms_sent` → `skipped (no_tenant)`, no owner email, nothing shows in inbox.

## Root cause

The new tenant row (`growthsmartservice@gmail.com` / "Acme plumbing", id `05bcba6e…`) has:

- `assigned_callcapture_number = "19048933328"` (missing `+`, not E.164)
- `vapi_phone_number_id = NULL`
- `vapi_assistant_id = NULL`

Vapi delivers `phoneNumberId = 1b023a8a-5769-4b29-98b0-e86c91bea2a9` and `assistantId = 05941684-9bec-4122-8c83-d16a57bd0376`, with `calledNumber = null` and no `metadata.client_id`. `vapi-webhook`'s 4-tier resolver (metadata → vapi_phone_number_id → assigned_callcapture_number → vapi_assistant_id) therefore has nothing to match on.

So an assistant + phone number **were** registered in Vapi for this tenant (calls answered end-to-end), but the tenant row was never updated with those IDs. Most likely provisioning ran through a path other than `provision-twilio-number` (which does persist both), or that call errored after purchase — either way the ids are stranded in Vapi with no DB link.

## Fix

### 1. Backfill the current tenant so their existing test call and future calls attribute correctly

- Add an admin-callable edge function `admin-backfill-vapi-ids` (service role) that:
  - Takes `client_id`.
  - Calls Vapi `GET /phone-number`, finds the record whose `number` matches the tenant's `assigned_callcapture_number` (normalized to E.164) — writes `vapi_phone_number_id` and its `assistantId` back to `callcapture_clients`.
  - Also normalizes `assigned_callcapture_number` to `+E.164`.
- Immediately run it for Acme (`05bcba6e-920c-46ee-8c2b-5032116cc767`) so their existing lead can be re-attributed.

### 2. Re-attribute the orphaned call/lead already captured

- Update `callcapture_calls` and `callcapture_leads` rows for `vapi_call_id = 019f1bc4-7343-7000-af81-78ac0e837515` to set `client_id = 05bcba6e…` after backfill (via a targeted SQL update in a migration). Then fire `send-sms` and `send-transactional-email` (owner) for that lead so notifications aren't lost.

### 3. Harden `vapi-webhook` so this class of miss never silently drops a lead again

- Add a 5th resolution tier: when `phoneNumberId` is present but no DB row matches, call Vapi `GET /phone-number/{id}`, read the `number`, normalize, and match against `assigned_callcapture_number` (E.164 compare on digits). On match, persist `vapi_phone_number_id` (and `vapi_assistant_id` from the same record) back to the tenant so subsequent calls resolve on tier 2 with no external call.
- Same self-healing fallback when `assistantId` is present but not matched: `GET /assistant/{id}`, look for `metadata.client_id` we set at creation, or scan `callcapture_clients` for the assistant id.
- If still unresolved after all tiers, insert a **placeholder lead with `client_id = NULL`** plus the extracted fields and the raw payload, so the record is never lost and can be reassigned from the Admin panel. Log `unattributed_lead_created` in `callcapture_webhook_events`.

### 4. Fix the provisioning gap so new tenants can never end up in this state

- In `provision-twilio-number`, if step 2 (assistant upsert) or step 3 (Vapi phone-number register) fails partway, still persist whatever ids we did get, and return `routing_status = needs_configuration` with a clear error. Today a mid-flow throw skips the DB update entirely.
- In `link-existing-number`, when `mode = byo`, also register the number with Vapi (same call as step 3 of `provision-twilio-number`) and persist `vapi_phone_number_id` + `vapi_assistant_id`. Right now it only writes `assigned_callcapture_number`, which is why brand-new tenants that went through that path have no ids.
- Always write `assigned_callcapture_number` in `+E.164` (normalize before insert/update in both provisioning functions and `link-existing-number`).

### 5. Add an admin diagnostic surface

- In `Admin.tsx`, for each tenant show `vapi_phone_number_id`, `vapi_assistant_id`, `assigned_callcapture_number`, plus a **"Backfill Vapi IDs"** button that calls the new function from step 1 and a **"Reassign orphaned leads"** button that lists `callcapture_leads` with `client_id IS NULL` and lets the super admin bind them to a tenant.

## Verification

- Re-run diagnostics on the Acme tenant: fresh `place-test-call` should log `tenant_matched = ok (matchedBy: vapi_phone_number_id)`, followed by `lead_created ok`, `sms_sent ok`, `owner_email_sent ok`.
- The already-captured Robert Blackson lead should appear in the Acme dashboard inbox after step 2 backfill.
- Create a throwaway tenant, go through phone setup, place a test call — should end-to-end land in the inbox with notifications on the first try.

## Technical notes

- Files touched: `supabase/functions/vapi-webhook/index.ts`, `supabase/functions/provision-twilio-number/index.ts`, `supabase/functions/link-existing-number/index.ts`, new `supabase/functions/admin-backfill-vapi-ids/index.ts`, `supabase/config.toml` (register the new function with `verify_jwt = false` since it uses service role + shared secret), `src/pages/Admin.tsx`, one SQL migration to reassign the orphaned call/lead.
- No schema changes required; all needed columns already exist on `callcapture_clients` and `callcapture_leads`.
- SMS/Twilio flow is untouched.