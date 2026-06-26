
## Findings — ServanaHQ's actual lead pipeline

The ServanaHQ project (Lovable workspace name "Git To Love", Supabase ref `vwnqekfnluvqwnlauxxh`) has **two existing intake entry points**, not one:

### 1. `public-external-booking` (website form submissions)
Writes synchronously into 3 tables, then notifies via SendGrid + Twilio.

| Table | Required / notable columns | Notes |
|---|---|---|
| `customers` | `user_id` (tenant), `name`, `phone` (E.164), `email`, `status='lead'`, `addresses` (jsonb array of `{line}`), `appliances` (jsonb array of `{type,brand,model}`), `last_contacted_at` | Upsert keyed by `(user_id, phone)`. If found, merges new address + appliance into existing arrays. |
| `jobs` | `job_number='pending'`, `user_id`, `customer_id`, `appliance_type`, `brand`, `model_number`, `issue_description`, `status='new'`, `address` | Always inserted. |
| `leads` | `tenant_id`, `customer_id`, `job_id`, `status='new'`, `customer_name`, `phone`, `email`, `address`, `appliance_type`, `brand`, `model_number`, `issue_description`, `source`, `ai_summary` | Insert only. `source` defaults to "External Website". |

Tenant resolution: looks up the single `profiles` row where `is_super_admin=true` (oldest) and uses that `user_id` as `tenant_id` / `user_id` on all rows. No RPCs.

### 2. `intake-vapi` (Vapi voice intake — already exists and is the right reuse target)
This is ServanaHQ's existing AI-call intake. It writes to a **moderation queue**, not directly to `leads`/`jobs`.

| Table | Notable columns | Notes |
|---|---|---|
| `intake_reviews` | `tenant_id`, `source='vapi_voice'`, `status='pending'`, `customer_name`, `phone`, `email`, `address`, `appliance_type`, `brand`, `model_number`, `issue_description`, `ai_summary`, `transcript`, `raw_payload`, `confidence_score`, `customer_id` (nullable, matched by phone last-10) | Required: `customer_name`, `phone`, `address`, `appliance_type`, `issue_description`. |
| `communications_log` | `user_id`, `customer_id`, `channel='sms'`, `direction='outbound'`, `recipient`, `body_summary`, `status`, `payload` | Owner SMS notification (Twilio direct, not connector). |

Tenant resolution: hard-coded `DEFAULT_TENANT_ID = '428e8ad3-75b8-4ba6-83ff-a8f81edf051c'`. It also accepts **top-level field payloads** (Path C) so a clean JSON POST with the canonical field names is sufficient — no Vapi-shaped wrapper required.

### Conclusion
`intake-vapi` already does exactly what `ingest-vektuor-lead` was about to duplicate: validates fields, normalises phone, matches existing customer by last-10 digits, inserts into the review queue, and fires the owner SMS. Vektuor calls are conceptually identical to ServanaHQ's own Vapi calls — they should land in the same `intake_reviews` queue so the operator workflow is unified.

The only gap is **multi-tenant routing**: `intake-vapi` currently ignores the caller and writes everything to one super-admin tenant.

---

## Plan — reuse, don't duplicate

### A. Changes in ServanaHQ (`Git To Love` project)
Two small edits to `supabase/functions/intake-vapi/index.ts`:

1. **Accept an explicit tenant override.** Read `body.tenant_id` (or header `x-vektuor-tenant-id`) and, if present and a valid uuid that exists in `profiles.user_id`, use it as `tenant_id` instead of `DEFAULT_TENANT_ID`. Fall back to the current behaviour when absent.
2. **Authenticate cross-project callers.** Accept header `x-vektuor-key` and compare against new secret `VEKTUOR_INGEST_KEY`. Required only when `tenant_id` is provided (so existing Vapi traffic is unaffected). Reject mismatch with 401.
3. Add `source='vektuor_voice'` when the request carries the Vektuor key, so reviewers can tell the two voice surfaces apart.

No schema migration is needed — `intake_reviews`, `customers`, and `communications_log` are reused as-is.

### B. Changes in Vektuor (this project)
1. **Delete the unused stub** `servanahq/functions/ingest-vektuor-lead/index.ts` — we are not deploying a new ServanaHQ function.
2. **Rewrite `supabase/functions/sync-servanahq/index.ts`** to POST to ServanaHQ's existing endpoint:
   - URL: `${SERVANAHQ_BASE_URL}/intake-vapi` (where `SERVANAHQ_BASE_URL = https://vwnqekfnluvqwnlauxxh.supabase.co/functions/v1`).
   - Headers: `x-vektuor-key: ${SERVANAHQ_INGEST_KEY}`, `Authorization: Bearer ${SERVANAHQ_ANON_KEY}` (Supabase functions require an apikey or auth header for routing).
   - Body (top-level fields, hits intake-vapi's Path C):
     ```json
     {
       "tenant_id": "<callcapture_clients.servanahq_tenant_id>",
       "customer_name": "...",
       "phone": "...",
       "email": "...",
       "address": "...",
       "appliance_type": "<service / category>",
       "brand": "...",
       "model_number": "...",
       "issue_description": "...",
       "ai_summary": "...",
       "transcript": "...",
       "call_id": "<vapi call id>"
     }
     ```
   - Map Vektuor fields → ServanaHQ canonical names: `service` → `appliance_type`, `summary` → `ai_summary`, `customer_name`/`phone`/`address`/`email`/`brand`/`model_number`/`issue_description`/`transcript` pass through unchanged.
3. Update `callcapture_leads.servanahq_sync_status` / `_error` based on the HTTP response from `intake-vapi`.
4. `servanahq-status` edge function: keep, but the "pending endpoint" warning now flips to green as soon as `SERVANAHQ_BASE_URL` + `SERVANAHQ_INGEST_KEY` are both set in Vektuor.

### C. Secrets
- Vektuor (this project, via add_secret after plan approval): `SERVANAHQ_BASE_URL = https://vwnqekfnluvqwnlauxxh.supabase.co/functions/v1`, `SERVANAHQ_INGEST_KEY = <generated>`.
- ServanaHQ (set in that project by the user): `VEKTUOR_INGEST_KEY = <same value>`.

### D. Verification
1. Place one Vektuor test call against the active mock tenant.
2. Expect: row in Vektuor `callcapture_leads` with `servanahq_sync_status='ok'`, row in ServanaHQ `intake_reviews` (`source='vektuor_voice'`, `tenant_id` = the mock tenant's mapped `servanahq_tenant_id`), and one Twilio SMS via `communications_log`.

---

## Question for you before I switch to build

The `intake-vapi` edits live in the **ServanaHQ** project (`Git To Love`), and cross-project tools are read-only — I can't push the edit there from here. Two ways to handle that:

1. **You paste the change.** I'll write the full new `index.ts` for `intake-vapi` in this plan's follow-up so you can copy it into `Git To Love` yourself, then I do the Vektuor side here.
2. **Skip the ServanaHQ edit for now** and have Vektuor POST with no `tenant_id`, accepting that every Vektuor call lands under the ServanaHQ super-admin tenant (same as today's ServanaHQ voice calls). Multi-tenant routing comes later.

Which do you want — option 1 (proper multi-tenant, requires you to apply one file in ServanaHQ) or option 2 (single-tenant for now, no ServanaHQ change)?
