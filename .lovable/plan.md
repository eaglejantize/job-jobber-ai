# Magic-Link Auth + Reliable Post-Payment Flow

## Goal
1. One-click magic-link auth (no passwords).
2. Every `callcapture_clients` row is linked to its `auth.users` user via `user_id`.
3. Stripe checkout returns straight to `/dashboard` — no "Confirming payment" loader, no blocking on the webhook.
4. Webhook updates the client row by email, setting `payment_status`, `subscription_status`, and `stripe_customer_id`.
5. Dashboard requires auth, loads by `user_id`, and gracefully polls if the webhook is delayed.

## Database changes (one migration)

`callcapture_clients.user_id` already exists (nullable uuid). Two more changes:

1. **Add `subscription_status` column** (text, nullable). Defaults to NULL until first webhook.
2. **Triggers to keep `user_id` linked by email** — covers both directions:
   - Before insert on `callcapture_clients`: if `user_id` is null, look up `auth.users` by lowercase email.
   - After insert on `auth.users`: backfill `user_id` on any existing client rows with a matching email.

Both functions use `SECURITY DEFINER` and `set search_path = public` per project rules. Triggers, not CHECK constraints.

## Auth: magic link only (`src/pages/Auth.tsx`)

Replace the password form with a single email field that calls:

```ts
supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${window.location.origin}/dashboard`,
    shouldCreateUser: true,
  },
});
```

`shouldCreateUser: true` means signup and signin are the same action — first-time emails create the user automatically; returning users just get a login link. After submit, show "Check your email — we sent a login link to {email}." No separate signup flow, no password.

`useAuth` already listens via `onAuthStateChange` — no change needed.

## Signup payload from `/start`

`src/pages/Start.tsx`:
- Keep the anonymous insert into `callcapture_clients` (the trigger will link `user_id` later when they click the magic link).
- Right before calling `create-checkout`, fire a magic link to the same email so it's waiting in their inbox by the time Stripe redirects them back:
  ```ts
  await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/dashboard`, shouldCreateUser: true },
  });
  ```
  Best-effort — don't block the Stripe redirect on failure.
- Change the on-`/start`-stripe-return bounce target from `/setup` → `/dashboard`.

`src/pages/Confirm.tsx`: change bounce target from `/setup` → `/dashboard`.

## Stripe checkout (`supabase/functions/create-checkout/index.ts`)

- `success_url`: `${origin}/dashboard?checkout=success`
- `cancel_url`: `${origin}/start?canceled=1` (already correct)

No other logic changes — `client_id` still flows through metadata.

## Stripe webhook (`supabase/functions/stripe-webhook/index.ts`)

In `checkout.session.completed`:

```ts
const session = event.data.object as Stripe.Checkout.Session;
const clientId = session.metadata?.client_id ?? null;
const email = session.customer_details?.email ?? session.customer_email ?? null;

const update = {
  payment_status: "active",
  subscription_status: "active",
  setup_status: "Setup In Progress",
  stripe_customer_id: (session.customer as string) ?? null,
  stripe_subscription_id: (session.subscription as string) ?? null,
};

let q = supabase.from("callcapture_clients").update(update);
q = clientId ? q.eq("id", clientId) : email ? q.ilike("email", email) : null;
if (!q) { console.warn("no client_id or email"); break; }
const { error } = await q;
```

Lowercase the values (`payment_status: 'active'`) per the request. Subscription update/delete handlers stay, but switch their values to lowercase too for consistency (`active`, `past_due`, `canceled`, `inactive`).

## Setup page (`src/pages/Setup.tsx`)

Remove:
- `sessionId` polling block
- `gate` state
- "Confirming your payment…" loader
- "We couldn't confirm your payment" screen

Setup wizard becomes immediately usable for any logged-in user. If `?session_id=...` shows up, ignore it.

## Dashboard (`src/pages/Dashboard.tsx`)

- Already gates on `useAuth` and redirects to `/auth` when signed out — keep.
- On mount, query `callcapture_clients` by `user_id` (already does).
- **Webhook-delay fallback:** if the latest client row has `payment_status !== 'active'` (or no row yet), set up a 3-second polling interval that re-queries until either the row is active or 30 seconds have passed. Show a small inline "Finalizing your payment…" badge in the status card during polling — never block the page or the rest of the dashboard.
- When `?checkout=success` is in the URL, show a one-time toast "Payment received." and clean the param via `replace`.
- Update the status badge logic to recognize lowercase `active`.

## Status value migration

To keep existing rows consistent, the migration also normalizes existing values:
```sql
update public.callcapture_clients
   set payment_status = lower(payment_status)
 where payment_status is not null;
```
Default for new rows stays `'Payment Pending'` until first checkout (we'll keep that string as-is — the dashboard treats anything other than `'active'` as not-yet-active).

## Files changed

- `supabase/migrations/<new>.sql` — add `subscription_status` column, two trigger functions + triggers, normalize existing payment_status values.
- `src/pages/Auth.tsx` — magic-link only.
- `src/pages/Start.tsx` — fire magic link before Stripe redirect; bounce target → `/dashboard`.
- `src/pages/Confirm.tsx` — bounce target → `/dashboard`.
- `src/pages/Setup.tsx` — strip the payment-confirmation gate.
- `src/pages/Dashboard.tsx` — `?checkout=success` toast, polling fallback for delayed webhook, lowercase status handling.
- `supabase/functions/create-checkout/index.ts` — `success_url` → `/dashboard?checkout=success`.
- `supabase/functions/stripe-webhook/index.ts` — email fallback lookup, write `subscription_status`, lowercase status values.

## Out of scope
- Google sign-in (you asked specifically for magic link).
- Custom-branded auth email templates (default Lovable templates are fine unless you ask).
- RLS changes — existing `own client select`/`update` policies on `user_id` are correct and will work the moment the trigger sets `user_id`.
