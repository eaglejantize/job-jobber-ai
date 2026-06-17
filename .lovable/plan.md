## Root cause

`public.callcapture_leads` has **zero GRANTs** in `information_schema.role_table_grants` — not for `service_role`, `authenticated`, or `anon`. The edge function uses the service role key to insert, but PostgREST/Postgres rejects the write because the role has no table-level privilege. The insert silently fails and only the SMS goes through, which matches what we see: 1 manually-inserted test row, no rows from Vapi.

A secondary problem: the current `console.error("lead insert failed", insertError.message)` drops the Postgres `code`, `details`, and `hint`, so failures look like generic strings in the logs.

## Fix

### 1. Migration — add Data API grants on `callcapture_leads`

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_leads TO authenticated;
GRANT ALL ON public.callcapture_leads TO service_role;
```

No `anon` grant (no anon-facing policy). RLS stays as-is — service_role bypasses it; the existing `authenticated can read leads` policy keeps inbox reads working.

### 2. Edge function — better error logging in `supabase/functions/send-demo-sms/index.ts`

In the lead-insert block:

- Log full error object including `message`, `code`, `details`, `hint`, plus the row payload keys, so a future failure is debuggable from `edge_function_logs`.
- Log a one-line `"lead insert attempt"` before the call with `{ phone, hasIssue, hasSummary, isToolCall }` so we can confirm the branch ran.
- Keep best-effort behavior (do not fail the webhook on DB error).
- Surface `leadId` and an `insertError` summary in the JSON response (already returns `leadId`; add `dbError` when present) so curl tests show DB status without needing log access.

No schema/business logic changes beyond the grants. No changes to extraction, SMS sending, or the leads UI.

## Verification

1. Run migration; re-check `information_schema.role_table_grants` shows the new rows.
2. `curl` the deployed function with a valid `x-webhook-secret` and a sample Vapi tool-call payload; expect 200 with `leadId` populated.
3. `SELECT … FROM callcapture_leads ORDER BY created_at DESC LIMIT 5` — new row present.
4. Check `edge_function_logs` for `"lead insert attempt"` and the absence of `"lead insert failed"`.
5. Open `/leads` in the app — new row visible.
