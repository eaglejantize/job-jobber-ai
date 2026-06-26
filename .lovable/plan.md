# Deploying `ingest-vektuor-lead` into the real ServanaHQ project

No code changes in Vektuor on this turn. This is a deployment + secret-wiring plan only.

## 1. Where to copy the file (inside the ServanaHQ Lovable/Supabase project)

Copy the reference file from this Vektuor repo:

```
servanahq/functions/ingest-vektuor-lead/index.ts   (here, in Vektuor)
```

into the ServanaHQ project at exactly:

```
supabase/functions/ingest-vektuor-lead/index.ts
```

Do not put it in a subfolder. No `deno.json` or `import_map` needed — the file uses an `esm.sh` import and `Deno.serve`. Default `verify_jwt = false` is fine (we authenticate via shared bearer token in the function body).

## 2. How to deploy it

Two options, pick one:

- **Lovable (recommended).** Open the ServanaHQ project in Lovable and ask it to "deploy the edge function `ingest-vektuor-lead`". Lovable-managed edge functions deploy automatically once the file is committed; no CLI step.
- **Supabase CLI** (if you prefer manual):
  ```
  supabase functions deploy ingest-vektuor-lead --project-ref <SERVANAHQ_PROJECT_REF>
  ```

## 3. Secret the ServanaHQ function expects

Only one custom secret in the ServanaHQ project:

- `SERVANAHQ_API_KEY` — shared bearer token. The function rejects any request whose `Authorization` header is not exactly `Bearer ${SERVANAHQ_API_KEY}`.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase — do not set those manually.

## 4. Table — migration required

The reference function writes to `public.lead_inbox` with these columns:

```
id, tenant_id, source, lead_source,
customer_name, phone, email, service_address,
business_category, service_requested,
appliance_type, brand, model_number, issue_description,
preferred_day, preferred_time,
call_summary, transcript,
vektuor_call_id (unique), recording_url,
metadata jsonb, created_at
```

Two cases:

- **If ServanaHQ already has a Lead Inbox table with a different name/columns**, do *not* run a new migration — instead edit the ServanaHQ function to `.from("<existing_table>")` and remap field names before upsert. Keep `vektuor_call_id` (add it as a nullable unique column) so re-syncs stay idempotent.
- **If ServanaHQ has no Lead Inbox table yet**, run a migration in the ServanaHQ project that creates `public.lead_inbox` exactly as listed above, with `GRANT ALL ... TO service_role`, RLS enabled, and (optionally) a tenant-scoped read policy. The service-role function bypasses RLS for writes.

I'll know which case applies as soon as you confirm whether ServanaHQ already has a lead inbox table.

## 5. `SERVANAHQ_BASE_URL` value Vektuor should use

After deployment, the URL is deterministic:

```
SERVANAHQ_BASE_URL = https://<SERVANAHQ_PROJECT_REF>.functions.supabase.co
```

Vektuor's `sync-servanahq` already appends `/ingest-vektuor-lead`, so set the base URL to the `.functions.supabase.co` root — no trailing slash, no path.

(If the ServanaHQ project uses a custom Functions domain, substitute that origin instead.)

## End-to-end cutover (after you confirm the above)

1. You give me the ServanaHQ project ref (or the full functions origin).
2. In **ServanaHQ**: deploy `ingest-vektuor-lead`, set `SERVANAHQ_API_KEY` (generate a strong random value once), run the `lead_inbox` migration if needed.
3. In **Vektuor**: I'll call `set_secret` for `SERVANAHQ_BASE_URL` and `add_secret` for `SERVANAHQ_API_KEY` (same value you set in ServanaHQ).
4. Pick one non-super-admin tenant, toggle `servanahq_enabled` on, set its `servanahq_tenant_id`.
5. Run one test call via the Vektuor Test Call panel.
6. Verify:
   - 1 row in Vektuor `callcapture_leads` scoped to that tenant, `servanahq_sync_status = 'success'`.
   - 1 row in ServanaHQ `lead_inbox` with matching `vektuor_call_id` and `tenant_id`.

## Question I need answered before step 4 of the plan

Does the ServanaHQ project already have a Lead Inbox table? If yes, what's its table name and the column names for customer name, phone, address, summary, and transcript? That decides whether we ship a migration or just remap fields inside the function.
