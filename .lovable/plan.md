## Plan: Convert demo users into paying customers — no dead ends

End-to-end funnel:

```text
/demo (call ends)  ┐
/support (form done)┤──►  /start  ──►  Stripe Checkout  ──►  /setup (6 steps)  ──►  /dashboard
                   ┘                                                                  │
                                                                                      └─► "Request Setup Help"
```

### 1. New table `callcapture_clients`

Migration adds:

```sql
CREATE TABLE public.callcapture_clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid,                          -- nullable (form may submit pre-auth)
  owner_name      text NOT NULL,
  business_name   text NOT NULL,
  email           text NOT NULL,
  alert_phone     text NOT NULL,
  setup_status    text NOT NULL DEFAULT 'Payment Pending',
                  -- 'Payment Pending' | 'Setup In Progress' | 'Live'
  payment_status  text NOT NULL DEFAULT 'Inactive',
                  -- 'Inactive' | 'Active' | 'Past Due' | 'Canceled'
  stripe_customer_id           text,
  stripe_subscription_id       text,
  stripe_checkout_session_id   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.callcapture_clients ENABLE ROW LEVEL SECURITY;
```

RLS:
- INSERT: anyone (anon + authenticated) — required because the user fills `/start` before/while signing in. Validated via WITH CHECK on field shape.
- SELECT/UPDATE: only the row owner (`auth.uid() = user_id`). Webhook writes use the service role, which bypasses RLS.
- No DELETE policy.

Trigger to keep `updated_at` fresh (reuses existing `set_updated_at()` function).

### 2. Stripe — bring-your-own-key (your choice)

You picked "use my keys", so we use the existing BYOK Stripe integration. Required runtime secrets (we'll request them with the secrets tool, one prompt):

- `STRIPE_SECRET_KEY` — your `sk_live_...` (or `sk_test_...` to start)
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` from the webhook you'll create in Stripe pointing at `…/functions/v1/stripe-webhook`

Pricing model — created lazily in code on first checkout (no Dashboard work for you):
- One-time **price_data**: $99 setup fee
- Recurring **price_data**: $197/month subscription
Both go into a single Checkout Session with `mode: "subscription"` and a one-time line item alongside. (Stripe supports mixing one-time + recurring in a subscription Checkout.)

### 3. Edge functions (2 new)

#### `supabase/functions/create-checkout/index.ts`
- Public (no JWT), CORS enabled.
- Body (zod): `{ clientId: uuid }`.
- Loads the client row (service role), creates/looks up Stripe Customer by email, creates Checkout Session:
  - `mode: "subscription"`
  - line items: $99 one-time + $197/mo recurring (USD)
  - `success_url: ${origin}/setup?session_id={CHECKOUT_SESSION_ID}`
  - `cancel_url:  ${origin}/start?canceled=1`
  - `metadata: { client_id }`, `subscription_data.metadata: { client_id }`
- Stores `stripe_checkout_session_id` + `stripe_customer_id` on the row.
- Returns `{ url }`.

#### `supabase/functions/stripe-webhook/index.ts`
- Public (no JWT). Verifies `Stripe-Signature` against `STRIPE_WEBHOOK_SECRET`.
- Handles:
  - `checkout.session.completed` → set `payment_status='Active'`, `setup_status='Setup In Progress'`, store `stripe_subscription_id`.
  - `customer.subscription.updated` → mirror status (`active`/`past_due`/`canceled`).
  - `customer.subscription.deleted` → `payment_status='Canceled'`.
- Logs success/failure. Always returns 200 unless signature invalid (400) — Stripe retries on non-2xx.

Both functions get a `[functions.stripe-webhook]` / `[functions.create-checkout]` block in `supabase/config.toml` only if needed; default `verify_jwt=false` is already what we want.

### 4. New page `/start` — `src/pages/Start.tsx`

Form (Zod-validated client + server-shape):
- Owner name, Business name, Email, Mobile (alert) phone.

On submit:
1. Insert into `callcapture_clients` (status defaults).
2. Call `supabase.functions.invoke("create-checkout", { body: { clientId } })`.
3. `window.location.href = data.url` (Stripe Checkout).

Copy: "We set this up for you. Live in 24 hours. No tech skills required."

### 5. Replace dead ends → route into `/start`

- **`src/pages/Support.tsx`** — keep the form (it still feeds `callcapture_support_requests` for white-glove leads), but remove the "You're on the list." terminal state. After successful submit, toast then `navigate("/start", { state: { prefill } })` so name/email/phone carry over.
- **`src/pages/Demo.tsx`** — change the two CTA buttons under `SampleLeadCard` from `/support` and `/setup` to a single primary "Get Started — $99 + $197/mo" → `/start`, plus a small secondary "Talk to a human" → `/support`. Update `RequestSetupBanner` defaults similarly (button now points at `/start`).

### 6. Replace `/setup` with the 6-step wizard (per your choice)

Rewrite `src/pages/Setup.tsx` to the spec:

1. **Business Info** — business type, service area, hours
2. **Call Goals** — multi-select: Capture leads / Existing customers / Info calls
3. **Info to Collect** — checklist: Name, Phone, Issue, Address, Urgency (+custom)
4. **Tone** — Friendly / Direct / Helpful (radio)
5. **Existing Customer Handling** — sensible default explained ("route to voicemail / forward to your line"), single toggle to override
6. **Generate Instructions** — show generated prompt, "Generate My AI Receptionist" button

On mount, if `?session_id=...` is present, look up the client by `stripe_checkout_session_id` and gate the wizard ("Confirming payment…" until `payment_status='Active'`, with a 2s poll up to 20s — the webhook usually wins the race). If no client / not paid, redirect to `/start`.

On final button:
- Persist business + assistant config to existing `callcapture_businesses` + `callcapture_assistant_configs` tables (existing `saveToCloud` logic, kept).
- Update `callcapture_clients.setup_status = 'Live'`.
- `navigate("/dashboard")`.

Header: `Step X of 6`, progress bar, hero copy "Let's set up your AI receptionist".

We'll reuse the existing `wizardSchema`, `generatePrompt`, and constants — just trim/relabel fields to match the 6-step grouping. The existing rich state is preserved, so the generated prompt stays identical and **Vapi/Twilio/SMS behavior is untouched**.

### 7. Dashboard tweaks (`src/pages/Dashboard.tsx`)

Add (no CRM):
- **Setup Status** badge (from `callcapture_clients.setup_status`)
- **Alert Phone** (from `callcapture_clients.alert_phone`)
- **Demo Number** (existing `DemoNumberCard`)
- **Assistant Instructions** (existing `generated_prompt` block)
- **Request Setup Help** button → `/support`

Leads-table page stays where it is (`/leads`) — unrelated.

### 8. Nav + routes

- `src/App.tsx` — add `<Route path="/start" element={<Start />} />` above the catch-all.
- `src/components/SiteNav.tsx` — replace the "Get Set Up in 24 Hours" header CTA target from `/support` to `/start`. Mobile menu CTA same.
- `src/components/RequestSetupBanner.tsx` — primary CTA → `/start`; keep "Talk to us" secondary → `/support`.

### 9. Files touched

New:
- migration: `callcapture_clients` + RLS + trigger
- `src/pages/Start.tsx`
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/stripe-webhook/index.ts`

Edited:
- `src/pages/Setup.tsx` — rewrite to 6-step wizard, gate on payment
- `src/pages/Support.tsx` — remove terminal screen, redirect to `/start`
- `src/pages/Demo.tsx` — CTAs point at `/start`
- `src/pages/Dashboard.tsx` — surface client status + alert phone + Request Setup Help
- `src/components/SiteNav.tsx`, `src/components/RequestSetupBanner.tsx` — CTA targets
- `src/App.tsx` — register `/start`

Untouched (no behavior change):
- `supabase/functions/send-demo-sms/index.ts` (Vapi/Twilio/SMS)
- `callcapture_leads`, `callcapture_businesses`, `callcapture_assistant_configs`, `callcapture_support_requests`
- `/demo` core experience and `/leads`

### 10. Setup steps required from you

After I scaffold the code I'll prompt for the two Stripe secrets via the secrets tool. Then:

1. In the Stripe Dashboard → Developers → Webhooks, add an endpoint:
   `https://mzqazxtcwqumroqtmtjd.functions.supabase.co/stripe-webhook`
   with events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Paste the resulting `whsec_...` when I prompt.
2. Use `sk_test_...` first, end-to-end test with Stripe's `4242 4242 4242 4242` card, then swap for `sk_live_...`.

### Out of scope
- No customer portal / cancel-subscription UI (can add later).
- No CRM features in dashboard.
- No changes to demo SMS flow, Vapi schema, or the existing `/leads` inbox.

Approve to implement.