# ServanaHQ Lead Inbox Sync — Corrected Architecture

Architecture: **Vektuor edge function → ServanaHQ Supabase Edge Function (`ingest-vektuor-lead`) → ServanaHQ Lead Inbox table**.

## 1. Database (Vektuor side)

Migration on `callcapture_clients`:
- Rename plan field `servanahq_account_id` → **`servanahq_tenant_id text`** (matches ServanaHQ terminology in payload).
- Keep `servanahq_enabled boolean default false`.
- Drop `servanahq_endpoint_url` (URL is global, not per-tenant).

On `callcapture_leads`:
- `servanahq_lead_id text`
- `servanahq_synced_at timestamptz`
- `servanahq_sync_status text` (`pending` | `synced` | `failed` | `disabled` | `not_configured`)
- `servanahq_sync_error text`

(The earlier migration already added `servanahq_enabled`, `servanahq_account_id`, `servanahq_endpoint_url`, `servanahq_lead_id`, `servanahq_synced_at`. The new migration renames/drops to match.)

## 2. Secrets (Vektuor side)

Request via `add_secret`:
- `SERVANAHQ_BASE_URL` — `https://<servanahq-project-ref>.supabase.co` (no trailing slash). User must provide once their ServanaHQ project is known.
- `SERVANAHQ_API_KEY` — global bearer token both sides agree on.

If either is missing at sync time → log `servanahq_check` = `skipped` with reason `not_configured`, mark lead `sync_status='not_configured'`, surface "ServanaHQ integration pending endpoint" in UI.

## 3. New Vektuor edge function: `supabase/functions/sync-servanahq/index.ts`

Input: `{ client_id, lead_id }`. Service-role only.

Steps with diagnostics (each logged to `callcapture_webhook_events`):
1. `servanahq_check` — load client + lead; verify `servanahq_enabled`, `servanahq_tenant_id`, `SERVANAHQ_BASE_URL`, `SERVANAHQ_API_KEY`. Skip with explicit reason if any missing.
2. `servanahq_mapping` — log `{servanahq_tenant_id, lead_id}`.
3. `servanahq_payload` — build the exact body per spec (field map from `callcapture_leads` + client industry).
4. `servanahq_request` — log POST URL + tenant id (never the bearer token).
5. POST `${SERVANAHQ_BASE_URL}/functions/v1/ingest-vektuor-lead` with `Authorization: Bearer ${SERVANAHQ_API_KEY}` and JSON body.
6. `servanahq_response` — log HTTP status + (truncated) response body.
7. On 2xx: update lead `servanahq_lead_id`, `servanahq_synced_at`, `sync_status='synced'`; log `servanahq_synced`.
8. On non-2xx: update lead `sync_status='failed'`, `servanahq_sync_error`; log `servanahq_failed`.

Never throws — always returns 200 with `{ok:boolean, reason?}` so it can't break the call pipeline.

### Payload field mapping

| Payload field | Source |
|---|---|
| `servanahq_tenant_id` | client.servanahq_tenant_id |
| `source` | "Vektuor" |
| `lead_source` | "AI Answering Service" |
| `customer_name` | lead.name |
| `phone` | lead.phone |
| `email` | lead.email |
| `service_address` | lead.address |
| `business_category` | client.industry |
| `service_requested` | lead.treatment / lead.service |
| `appliance_type` / `brand` / `model_number` | `lead.intake_answers?.appliance_type` etc. |
| `issue_description` | lead.summary |
| `preferred_day` / `preferred_time` | parsed from lead.timing |
| `call_summary` | call.issue_summary |
| `transcript` | raw_payload.transcript |
| `vektuor_call_id` | raw_payload.vapi_call_id |
| `recording_url` | call.recording_url |
| `metadata` | `{ vektuor_lead_id, vektuor_client_id, raw: lead.raw_payload }` |

## 4. Wire into call pipeline

In `supabase/functions/vapi-webhook/index.ts`, after `lead_created` + SMS attempt, fire-and-forget invoke `sync-servanahq` with the new lead id. Wrap in try/catch — never blocks. Also remove the `(matchedBy:'assigned_callcapture_number')` super-admin filter loophole already in place — confirmed safe.

## 5. Place-test-call hardening

`supabase/functions/place-test-call/index.ts`:
- Already requires explicit `client_id`. Add: reject if target client has `is_super_admin=true` → 400 `"Cannot place test call to super admin tenant"`.
- Accept optional `vapi_assistant_id` / `vapi_phone_number_id` overrides from the admin caller; otherwise use tenant's stored ids (no change for self-serve).

## 6. UI

**`src/components/settings/ServanaHqSettings.tsx`** (new):
- Toggle "Enable ServanaHQ sync"
- Input "ServanaHQ Tenant ID"
- Shows current status:
  - "Connected — last sync …" (green) when a lead was synced.
  - "ServanaHQ integration pending endpoint" (amber) when global secrets are missing (queried via a tiny `servanahq-status` function that just returns `{configured: boolean}` — never exposes the key).
- Mounted in AI Settings panel.

**`src/components/TestCallButton.tsx`** — extend the result checklist with new steps:
- ✅ Vektuor lead created (`lead_created`)
- ✅ SMS alert sent (`sms_sent`)
- 🆕 ServanaHQ lead synced (`servanahq_synced` | `servanahq_failed` | `servanahq_check skipped` → renders "Not connected")
- Show `servanahq_sync_error` text on failure.

**`src/pages/Admin.tsx`** Diagnostics tab — already streams `callcapture_webhook_events`; add a filter chip for steps starting with `servanahq_` and color `servanahq_failed` red.

Admin TestCallButton already accepts `clientId` prop — confirm Admin renders it with the selected tenant id (not the admin's own client). Add tenant + Vektuor-number selectors in the Admin panel test-call dialog.

## 7. Deliverable for the ServanaHQ project: `servanahq/functions/ingest-vektuor-lead/index.ts`

Drop a reference implementation into the Vektuor repo at `servanahq/functions/ingest-vektuor-lead/index.ts` (not deployed — for the user to copy into the ServanaHQ Supabase project). Contents:

- Validates `Authorization: Bearer <SERVANAHQ_API_KEY>` (compare to `Deno.env.get("SERVANAHQ_API_KEY")` set in ServanaHQ project).
- Zod-validates request body.
- Resolves tenant by `servanahq_tenant_id`. 404 if unknown. Refuses if matched tenant is flagged super-admin unless tenant_id was explicit (it always is here).
- Inserts into ServanaHQ `lead_inbox` table with `tenant_id`, `source='Vektuor'`, all payload fields, plus `vektuor_call_id` for idempotency (unique index recommended).
- Returns `{ok:true, lead_id}` or `{ok:false, error}` with appropriate status.
- Logs each step via console for ServanaHQ diagnostics.

The user copies this file into their ServanaHQ project and deploys it there.

## 8. Pending-endpoint behavior

If `SERVANAHQ_BASE_URL` or `SERVANAHQ_API_KEY` secret is missing in Vektuor:
- `sync-servanahq` logs `servanahq_check` skipped with `not_configured`.
- Lead marked `sync_status='not_configured'`.
- UI badge: "ServanaHQ integration pending endpoint".
- No 4xx noise in diagnostics — just a single skipped row per call.

## Technical details

- Per-tenant credentials are NOT used in v1 (global key, per-tenant id). Easy to upgrade later by reading `servanahq_api_key` from client row if present.
- `SERVANAHQ_API_KEY` is generated by `add_secret`'s generate flow (or pasted by the user); same value must be set as a secret inside the ServanaHQ Supabase project.
- All ServanaHQ calls happen post-SMS so a failure there never blocks core lead capture.

## Open question

Confirm the ServanaHQ Supabase project ref so I can pre-populate `SERVANAHQ_BASE_URL` when adding the secret — or you can paste it into the secure form when prompted.
