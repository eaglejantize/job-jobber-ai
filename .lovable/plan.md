## Problem

Signup is failing silently from the user's perspective. Auth logs show two errors for `nfloridaallstar@gmail.com`:
- `POST /signup → 422 user_already_exists`
- `POST /token → 400 invalid_credentials` (fallback sign-in with the entered password fails)

`Start.tsx` then redirects to `/login?email=…` with only a generic toast, so it looks like "I can't create an account." Each auth user must have a unique email — to make a separate sub-account you need a different email.

No data, RLS, or tenant-isolation changes are required. Each `callcapture_clients` row is already scoped by `user_id` with RLS, so a new auth user = a fully isolated tenant.

## Fix (frontend only)

Update `src/pages/Start.tsx` signup error handling:

1. When `signUp` returns `user_already_exists`, do NOT silently attempt sign-in with the typed password. Instead show a clear dialog/toast:
   > "An account already exists for **{email}**. To create a separate sub-account, use a different email address (e.g. `you+business2@gmail.com`). Or sign in to your existing account."
   Provide two buttons: **Use a different email** (clears the email field, keeps other fields, stays on `/start`) and **Sign in instead** (navigates to `/login?email=…`).
2. Keep the existing "link prior anon client row by email" path only when the signup actually succeeded — never auto-claim another user's client row.
3. Surface other `signUp` errors verbatim in the toast (network, weak password, etc.) instead of swallowing them.

Update `src/pages/Auth.tsx` (login page) to add a small "Create a new account" link that routes to `/start` with no email prefill, so the user isn't stuck on the login screen with a prefilled email they don't want to reuse.

## Tenant isolation note (no change needed, just confirming)

- `callcapture_clients`, `callcapture_businesses`, `callcapture_assistant_configs`, `callcapture_leads` are all keyed off `user_id` / `client_id` with RLS using `auth.uid()`.
- A second auth user created with a different email will see only their own rows. No cross-tenant leakage.
- Service-role edge functions (Vapi webhook, Stripe webhook) continue to write per-business and remain unaffected.

## What this does NOT change

- No DB migrations, no RLS edits, no edge function edits.
- No multi-business-under-one-login feature (you said separate accounts with separate emails).
- Existing user `nfloridaallstar@gmail.com` and their data stay intact.

## Files touched

- `src/pages/Start.tsx` — replace the `alreadyExists` branch with a clear "use a different email / sign in" UX; stop attempting silent sign-in.
- `src/pages/Auth.tsx` — add a "Create a new account" link that goes to `/start` without prefill.
