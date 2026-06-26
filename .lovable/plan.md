## Where the rate limit comes from

The 50-second limit is **not in our code**. It is enforced by Supabase Auth (GoTrue) on the public `POST /auth/v1/signup` endpoint, which throttles confirmation-email sends per user (`over_email_send_rate_limit`). Auth logs confirm:

```
path=/signup  error_code=over_email_send_rate_limit  status=429
"For security purposes, you can only request this after 50 seconds."
```

It is hit because **`src/pages/Signup.tsx` calls `supabase.auth.signUp()` directly**, which triggers GoTrue's email-confirmation send. The newer `/start` flow already avoids this by using the `signup-tenant` edge function (service role + `admin.createUser` with `email_confirm: true`), which does not hit `/signup` and is not subject to that limit.

The limit cannot be "turned off" on a managed Supabase instance — the proper fix is to stop calling the public signup endpoint and route both pages through the admin path.

## Plan

### 1. Route `/signup` through `signup-tenant` (removes the rate-limited call)

In `src/pages/Signup.tsx`:
- Replace the `supabase.auth.signUp(...)` block with `supabase.functions.invoke("signup-tenant", { body: { ... } })`, matching the payload shape used by `Start.tsx` (owner_name, business_name, email, password, alert_phone, industry, dev_bypass).
- The form currently has no `owner_name` / `alert_phone` fields — pass `business_name` as the owner name fallback and a placeholder alert phone, OR (preferred) just redirect `/signup` to `/start` since `/start` is the canonical, working flow. Recommend the redirect to avoid maintaining two divergent flows.
- After success, call `supabase.auth.signInWithPassword` (same as `Start.tsx`) so a session exists before checkout.

### 2. Surface the real backend error

In both `Signup.tsx` and `Start.tsx` catch blocks:
- Log the full error object (`console.error("signup_failed", err, ctx)`) to the browser console.
- In the toast `description`, show the actual message returned by the edge function (`ctx.message`, `ctx.error`, or `err.message`) instead of the generic "Couldn't create account". Currently `Start.tsx` already does this for `err.message` but swallows `ctx.error`/`ctx.message` when no `signupErr` is present — tighten that branch.

### 3. Dev / founder-beta relaxation

Since the rate limit lives in Supabase Auth and we are no longer calling it from signup, no extra gating is needed for dev. The `signup-tenant` admin path has no per-email cooldown. As a safety net for any remaining `auth.signUp` callers (e.g. future password reset retries), keep the existing client-side `cooldownUntil` timer in `Start.tsx` but only arm it when the backend explicitly returns a 429 / `over_email_send_rate_limit`, not on every failure.

### 4. Verification

- Sign up the same email twice within 50s on `/signup` and `/start` — both should succeed (admin path) or fail with the exact backend reason (e.g. "email already registered"), never with the 50-second message.
- Confirm in `supabase--edge_function_logs` for `signup-tenant` that `auth_user_created` / `auth_user_found` fires.
- Confirm in auth logs that `POST /signup` is no longer called from our app.

## Files touched

- `src/pages/Signup.tsx` — swap to `signup-tenant` (or redirect to `/start`).
- `src/pages/Start.tsx` — improve error surfacing in the catch block.
- No edge function or DB changes required.
