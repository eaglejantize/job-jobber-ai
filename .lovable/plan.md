# Fix tenant account creation end-to-end

## Root causes found

1. **`supabase/functions/create-checkout/index.ts` is corrupted.** It currently contains a copy of the React `Start` page (346 lines of JSX/TSX) instead of a Deno edge function. Any invocation either runs a stale deployed version or fails outright, breaking the entire signup-to-checkout chain.
2. **RLS + email confirmation mismatch.** Auth logs confirm email confirmation is ON (`user_confirmation_requested`). `supabase.auth.signUp()` therefore returns no session. The current `Start.tsx` either:
   - Aborts at "Check your email" without ever creating a `callcapture_clients` row, or
   - (Older variant) attempts an anon insert that must satisfy `user_id IS NULL` plus non-empty trimmed fields — fragile and easy to violate.
3. **Existing-row update path runs as anon** — there is no anon UPDATE policy on `callcapture_clients`, so any retry hits RLS.
4. **No owner/membership link** exists today beyond the `user_id` column and the `link_user_to_clients` trigger that back-fills it by email after confirmation. This is implicit and easy to miss.

## Fix strategy (minimum-permission)

Per the user's explicit instruction, move tenant creation into an edge function that uses the service role. RLS stays fully enabled; no policy changes required.

### 1. New edge function: `supabase/functions/signup-tenant/index.ts`

- Public (no JWT required), CORS enabled, Zod-validated body: `owner_name`, `business_name`, `email`, `alert_phone`, `password`, optional `industry`.
- Uses `SUPABASE_SERVICE_ROLE_KEY` admin client.
- Steps with structured `console.log` at each:
  1. `signup_started` — log email (no password).
  2. Look up existing auth user by email via `admin.listUsers` (paginated search by email). If found and no password supplied → treat as conflict; if found with password → continue and reuse `user.id`.
  3. If not found → `admin.createUser({ email, password, email_confirm: false })` so the user can sign in immediately after Stripe. Log `auth_user_created` / `auth_user_found`.
  4. `client_insert_attempted` — `upsert` into `callcapture_clients` keyed by email: set `user_id`, `owner_name`, `business_name`, `email`, `alert_phone`, `industry`, `setup_status='Payment Pending'`, `payment_status='pending'`. Log `client_insert_success` with `client_id` or `client_insert_failed` with full error.
  5. `owner_link_created` — `user_id` on the row IS the owner link (single-tenant model today); also stamp `is_super_admin=false` explicitly. Log.
  6. Return `{ client_id, user_id }`.
- Errors return 4xx with `{ error, step }` so the client can show a precise message.

### 2. Rebuild `supabase/functions/create-checkout/index.ts`

Restore it as a real Deno edge function:
- Accept `{ client_id }` in body, validate.
- Use service role to load the client row, build the Stripe Checkout Session ($99/mo subscription, success_url=`/start?session_id={CHECKOUT_SESSION_ID}`, cancel_url=`/start?canceled=1`).
- Log `checkout_started`, `checkout_success` (with session id) / `checkout_failed`.
- Return `{ url }`.

### 3. Rewrite `src/pages/Start.tsx` submit handler

Replace the existing `supabase.auth.signUp` + direct insert flow with:
1. POST form to `signup-tenant` (anon key only — no session required).
2. On success, call `supabase.auth.signInWithPassword` so the browser has a session for the dashboard after returning from Stripe.
3. Invoke `create-checkout` with `{ client_id }` from step 1.
4. `window.location.href = checkout.url`.
5. Handle these error shapes from `signup-tenant`: `email_taken_no_password`, `validation_failed`, `auth_create_failed`, `client_insert_failed`. Surface "Sign in instead" link for the email-conflict case.

Remove the "Check your email" dead-end branch — email confirmation is bypassed for signup-via-tenant since we own the auth user creation server-side. (No global setting change.)

### 4. Deployment + verification

- Deploy `signup-tenant` and `create-checkout`.
- Acceptance test (Playwright, headless) on the live preview:
  1. Generate random new email.
  2. Fill /start form, submit.
  3. Assert redirect to `checkout.stripe.com`.
  4. Query `callcapture_clients` via psql for the email → row exists, `user_id` is set, `setup_status='Payment Pending'`.
  5. Query `auth.users` (via admin select isn't available — use `signInWithPassword` from a second Playwright session) to confirm sign-in succeeds.
- Capture and report every `console.log` step from the function logs to prove the trace.

## What this does NOT touch

- No changes to RLS policies on `callcapture_clients` (they are already correct for the authenticated dashboard read/write path).
- No changes to `link_user_to_clients` / `link_client_to_user` triggers — they remain as a safety net.
- No changes to Google Places, voice preview, onboarding, scheduling.
- No global auth setting changes.

## Files

- **Create**: `supabase/functions/signup-tenant/index.ts`
- **Rewrite (currently corrupted)**: `supabase/functions/create-checkout/index.ts`
- **Edit**: `src/pages/Start.tsx`
