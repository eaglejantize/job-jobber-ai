# Fix sub-account signup failure

## What's actually happening

The red toast in your screenshot is Supabase's rate-limit:
> "For security purposes, you can only request this after 47 seconds."

This fires when `supabase.auth.signUp` tries to send a confirmation email and the same email (or IP) already requested one in the last ~60 seconds. The frontend treats it as a generic "Couldn't create account" failure, so you have no way out except to wait and guess.

There's also a second, related bug: when email confirmation is on and you call `signUp` with an **already-registered email**, Supabase returns success with a fake user (empty `identities` array) instead of an error — so the current "already exists" branch never runs and the flow appears to succeed but actually doesn't create anything.

## Fix scope

Only the signup error handling on `/start` (the page in your screenshot). No backend/RLS, edge function, Vapi, or Twilio changes.

## Changes

### 1. `src/pages/Start.tsx` — robust signup error handling
- After `supabase.auth.signUp`, detect three distinct cases:
  - **Rate-limited** (`status === 429` or message contains "for security purposes" / "rate limit" / "after N seconds"): parse the seconds, show a friendly toast ("Please wait Ns before trying again — or sign in if you already have an account"), and offer a one-click "Sign in" link inline.
  - **Email already registered** (either an explicit error, OR `data.user && data.user.identities?.length === 0`): show the existing "use a different email or sign in" message, with a Sign-in link pre-filled with the email.
  - **Other errors**: show the raw Supabase message.
- Disable the submit button for the cooldown window so users can't spam the button.
- Add inline "Sign in instead" link below the email field whenever the email-exists error is shown, going to `/auth?email=<email>`.

### 2. `src/pages/Auth.tsx` — accept `?email=` prefill (already supported, just verify) and route Start-rejected users straight to sign-in.

### 3. (Optional, opt-in) Add a small helper `parseRetryAfter(msg)` in the same file — no new files, keeps the change tight.

## What I'm NOT changing
- RLS policies, edge functions, Stripe flow, `/signup`, or the dashboard.
- Tenant isolation rules — sub-accounts still require a new email.
- Auth settings (auto-confirm stays off).

## Verification
- Try submitting twice within 60s with a new email → second attempt shows the cooldown toast with seconds remaining and the button stays disabled until ready.
- Submit with an email that already has an account → see the "use a different email or sign in" toast plus the inline Sign-in link.
- Submit with a fresh email after cooldown → proceeds to Stripe checkout as before.
