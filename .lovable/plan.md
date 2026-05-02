# Fix /start RLS insert failure on callcapture_clients

## Root cause (confirmed by reproducing the error)

The RLS policies on `callcapture_clients` are **already correct**:

- `anyone can submit signup` — INSERT for `anon, authenticated`, CHECK requires non-empty `owner_name`, `business_name`, `email`, `alert_phone`.
- `own client select` — SELECT for `authenticated`, `auth.uid() = user_id`.
- `own client update` — UPDATE for `authenticated`, `auth.uid() = user_id`.
- No DELETE policy (delete is denied).
- No restrictive policies.

I reproduced the error with a direct REST call against the table using only the four required fields — it still returns `42501 / new row violates row-level security policy`. Even though the CHECK clause clearly passes, the request is denied.

The reason: **none of the public tables in this project have table-level `GRANT`s for `anon` or `authenticated`.** PostgREST evaluates SQL GRANTs *before* RLS. With no `INSERT` grant, the API rejects the row as an RLS failure regardless of policy contents. This is why every public-table mutation in the app is silently broken right now, not just `/start`.

Confirmed via:
```
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated');
-- returns 0 rows
```

So the policies don't need to be rewritten — they need to be backed by GRANTs.

## Changes

### 1. Database migration — add the missing GRANTs

For every table in `public` (`callcapture_clients`, `callcapture_businesses`, `callcapture_assistant_configs`, `callcapture_leads`, `callcapture_support_requests`):

- `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;`
- For `callcapture_clients` and `callcapture_support_requests` (which have anon INSERT policies): also `GRANT INSERT ON <table> TO anon;`
- `GRANT USAGE ON SCHEMA public TO anon, authenticated;` (idempotent safety).

RLS is already enabled on every table, so these grants are gated by the existing policies — no data is exposed beyond what the policies already permit.

The existing CHECK clause on `callcapture_clients` already matches the spec in the request (non-empty owner_name/business_name/email/alert_phone), so no policy rewrite is needed. SELECT/UPDATE remain restricted to authenticated owners; DELETE remains fully denied; anon gets INSERT only.

### 2. `src/pages/Start.tsx` — clean up the insert payload

- Stop sending `user_id` from the client. The column stays nullable; the webhook/setup flow links the row to the user later. Sending `user_id: null` is fine, but explicitly omit it to avoid future confusion.
- Add `payment_status: "Pending"` to match the requested initial state. (The column default is `'Inactive'`; we override to `'Pending'` as specified.)
- Keep `setup_status: "Payment Pending"`.
- Leave `created_at` to the DB default.

Final insert payload:
```ts
{
  owner_name, business_name, email, alert_phone,
  setup_status: "Payment Pending",
  payment_status: "Pending",
}
```

### 3. Verification (after applying)

- Repeat the anon REST insert against `callcapture_clients` — expect 201 with the new row.
- Submit `/start` from the preview and confirm:
  - A row is created with `setup_status='Payment Pending'`, `payment_status='Pending'`.
  - `create-checkout` returns a Stripe URL and the browser redirects to Stripe.
- Tail `postgres_logs` to confirm no further `42501` errors.

## Out of scope

- No changes to `create-checkout` or `stripe-webhook` edge functions.
- No auth flow changes; `/start` remains usable by anonymous visitors.
- No changes to other tables' policies (only adding the missing GRANTs).
