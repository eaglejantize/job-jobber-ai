# Dev Bypass for Stripe Checkout (30-Day Trial)

Goal: when a new subaccount signs up and a bypass flag is on, skip Stripe and mark the account Active (Trial) for 30 days. Stripe flow stays intact for production.

## How the bypass turns on

Two independent triggers — either one bypasses Stripe:

1. **Server flag (authoritative):** `BYPASS_BILLING` secret on the edge function. Values `true` / `1` enable it. Default off (production).
2. **Client/dev hint:** the signup form sends `dev_bypass: true` when running on `localhost`, `*.lovable.app`, or `*.lovable.dev`. The edge function honors it only when `ALLOW_DEV_BYPASS_HEADER=true` is also set, so production can never be tricked from the browser.

If neither trigger fires, behavior is unchanged: redirect to Stripe Checkout.

## Database

Add one nullable column so we can show/expire trials later:

```sql
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
```

No RLS changes (existing policies already cover the column for super admin / owner).

## Edge function: `supabase/functions/signup-tenant/index.ts`

After the auth user + client row are created/updated:

- Read `BYPASS_BILLING` and `ALLOW_DEV_BYPASS_HEADER` from env. Compute `bypass = serverFlag || (allowDevHeader && body.dev_bypass === true)`.
- If `bypass`:
  - Update the client row with:
    - `payment_status: "trial"`
    - `setup_status: "Active (Trial)"`
    - `trial_ends_at: now + 30 days`
  - Log `billing_bypassed { client_id, reason: "server_flag" | "dev_header" }`.
- Return `{ client_id, user_id, bypass_billing: <bool> }`.

## Frontend: `src/pages/Start.tsx`

In `onSubmit`, after `signup-tenant` succeeds:

- Send `dev_bypass: isDevHost()` in the request body, where `isDevHost()` checks `location.hostname` for `localhost`, `127.0.0.1`, `.lovable.app`, `.lovable.dev`.
- After sign-in:
  - If `signupRes.bypass_billing === true` → toast "Trial activated — 30 days free" and `navigate("/dashboard")`. Do not call `create-checkout`.
  - Otherwise → existing `create-checkout` + redirect to `checkout.url` (unchanged).

## Admin panel: `src/pages/Admin.tsx`

Small display tweaks only — no logic change to existing buttons.

- `StatusBadge` styles: add `trial: "bg-blue-500/15 text-blue-400 border-blue-500/30"` so `payment_status="trial"` renders cleanly. The `setup_status` column already shows the raw string, so "Active (Trial)" appears as-is.
- Filter chips: add `{ id: "trial", label: "Trial" }`.
- Overview stat card: rename "Manual / Trial" → "Trial" counted by `payment_status === "trial"`; add a separate "Manual" card for `manual`. (Keeps the 4-card grid.)

## Enabling the flag

`BYPASS_BILLING` and `ALLOW_DEV_BYPASS_HEADER` are not added automatically — after this lands I'll prompt you to add them via the secret tool when you want to turn the bypass on. Leaving them unset = production behavior (Stripe).

## Verification

1. With both secrets unset → sign up redirects to Stripe (current behavior).
2. With `BYPASS_BILLING=true` → sign up lands on `/dashboard`; row shows `payment_status=trial`, `setup_status=Active (Trial)`, `trial_ends_at ≈ now+30d`.
3. Admin panel shows the new badge + Trial filter + stat count.

## Files touched

- `supabase/migrations/<timestamp>_add_trial_ends_at.sql` (new)
- `supabase/functions/signup-tenant/index.ts` (bypass branch + response field)
- `src/pages/Start.tsx` (send dev_bypass, branch on response)
- `src/pages/Admin.tsx` (badge color, filter chip, stat card)
- `supabase/functions/create-checkout/index.ts` — **unchanged**
