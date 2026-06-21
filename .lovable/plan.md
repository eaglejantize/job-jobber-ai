# Fix: signup blocked by RLS on `callcapture_clients`

## Root cause

Email confirmation is enabled, so `supabase.auth.signUp()` in `src/pages/Start.tsx` returns a user **without** a session. The follow-up `INSERT` into `callcapture_clients` therefore runs as the **anon** role with `user_id` set to the new auth user id.

The only anon policy on the table is:

```
anon signup insert  →  WITH CHECK (user_id IS NULL AND ...trim checks...)
```

Because `user_id` is not null, the check fails → `new row violates row-level security policy`. The `auth signup insert` policy can't help — there's no session yet.

## Fix

Make anon signups insert with `user_id = NULL`, and rely on the existing `trg_link_user_to_clients` trigger (already on `auth.users`) to back-fill `user_id` once the auth user is created/confirmed. The `create-checkout` edge function uses the service role, so it doesn't need RLS access for the immediate Stripe redirect.

### 1. Migration

- Keep the `anon signup insert` policy exactly as-is (it already requires `user_id IS NULL` + trimmed fields). No schema change needed there.
- Tighten the `link_client_to_user` BEFORE-INSERT trigger so it only fills `user_id` from `auth.users` when the caller didn't already provide one (current behavior — keep). No change required, just verifying.
- Add an explicit `INSERT` policy for anon that also permits the row when `user_id IS NULL` after the trigger fires — already covered by existing policy; no migration needed.

Net result: **no schema migration is required**. The fix is in the client code.

### 2. `src/pages/Start.tsx` — branch on session presence

After `signUp()`, check whether a session was returned:

- **Session present** (email confirmation off): proceed with current `user_id: userId` path — matches `auth signup insert`.
- **No session** (email confirmation on): insert with `user_id: null`. Drop `user_id` from the insert payload (or set it explicitly to `null`). Use `.select("id").single()` to capture the new `clientId`, since `crypto.randomUUID()` would still work but reading it back is safer. Then call `create-checkout` with that `clientId`.

The `link_user_to_clients` AFTER-INSERT trigger on `auth.users` will set `user_id` on the row by email match once Supabase finalizes the user, and `create-checkout` (service role) can read/update the row immediately regardless.

### 3. Verify

1. Sign up a fresh email at `/start` → no RLS error, row created in `callcapture_clients` with `user_id` null initially, then populated by trigger.
2. Redirect to Stripe checkout succeeds.
3. After email confirmation + login, `own client select` policy returns the row to the user.

## Out of scope

- No change to admin or authenticated policies.
- No change to triggers or functions.
- No global RLS changes.
