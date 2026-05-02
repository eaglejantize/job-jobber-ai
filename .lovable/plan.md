# Email + Password Auth (Replace Magic Link)

## Goal
Old-school email/password login that works on phone and desktop. Add a Login button to the header. Signup happens on `/start` (with password fields) right before Stripe. Existing paid client rows get linked by email.

## Routing change
Add `/login` route pointing to the existing `Auth.tsx` page (rewritten). Keep `/auth` as an alias so old links still work.

## 1. Header — `src/components/SiteNav.tsx`
- Remove `/dashboard`, `/setup`, `/leads` from the public `links` array (these are auth-gated; keep them reachable from inside the dashboard, not the marketing nav). Keep Home, Demo, Pricing, Support.
- Desktop: add a **Login** link (text style, to `/login`) immediately to the left of the existing **Get Started** button.
- Mobile (hamburger menu): add a **Login** entry in the dropdown above the **Get Started** button.
- When a user is already signed in (use `useAuth`), swap **Login** → **Dashboard** link. Keep **Get Started** hidden for signed-in users.

## 2. `/start` — add password fields + create auth user
`src/pages/Start.tsx`:
- Extend the zod schema:
  - `password`: min 8
  - `confirm_password`: must equal `password` (use `.refine`)
- Add two new `<Input type="password">` fields after email, before phone, with `autoComplete="new-password"`.
- New submit flow (replaces the current insert + magic-link logic):
  1. Validate.
  2. `supabase.auth.signUp({ email, password, options: { emailRedirectTo: \`${origin}/dashboard\` } })`.
     - If error message indicates "already registered", call `signInWithPassword` with the entered password instead. If that also fails, surface a friendly toast: "An account already exists for this email. [Log in] or use a different email." (link to `/login?email=…`). Stop here — do not proceed to Stripe with mismatched creds.
  3. After successful signup/sign-in we have a `session.user.id`. Look for an existing `callcapture_clients` row by email:
     - If found and `user_id` is null → update that row: set `user_id`, refresh `owner_name`/`business_name`/`alert_phone` from form. Use its `id` as `clientId`.
     - If found and already linked to this user → reuse its `id`.
     - Otherwise → insert a new row with `user_id` set and the form fields.
     - The DB triggers `link_client_to_user` / `link_user_to_clients` already cover the email-match case as a safety net, but doing it explicitly here means the row is correct before we hit Stripe.
  4. Invoke `create-checkout` with `clientId` exactly as today.
  5. Redirect to Stripe.
- Remove the `signInWithOtp` call.
- Keep the Stripe-return bounce (`isStripeReturn` block) untouched.

Note: email-confirmation is on by default in Supabase. Even before the user confirms their email, `signUp` returns a session, so the Stripe redirect and post-payment dashboard load both work. The user will still need to confirm email later for some Supabase features, but login by password works immediately. (We are not enabling/changing auto-confirm — leaving Supabase defaults.)

## 3. `/login` (and `/auth`) — email + password — `src/pages/Auth.tsx`
Rewrite to a standard form:
- Fields: Email, Password (`autoComplete="current-password"`).
- Button: **Sign In** → `supabase.auth.signInWithPassword({ email, password })`.
- On success: `navigate("/dashboard")`.
- Below the form:
  - "Don't have an account? **Create account**" → `/start`
  - "**Forgot password?**" → opens an inline mode that calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${origin}/reset-password\` })` and shows a "Check your email" confirmation. (Adding the `/reset-password` page is in scope — see step 4.)
- Read `?email=` from the URL to prefill (used when `/start` redirects an existing user here).

## 4. `/reset-password` page (new)
Required so password reset works end-to-end (per Lovable auth guidance). New file `src/pages/ResetPassword.tsx`:
- Public route, added to `App.tsx`.
- On mount, Supabase auto-handles the recovery token in the URL hash (the client picks it up via `onAuthStateChange` → `PASSWORD_RECOVERY`).
- Show a single form: New password + Confirm password (min 8, must match).
- Submit → `supabase.auth.updateUser({ password })`. On success, toast and `navigate("/dashboard")`.

## 5. App routes — `src/App.tsx`
- Add `<Route path="/login" element={<Auth />} />`
- Add `<Route path="/reset-password" element={<ResetPassword />} />`
- Keep `/auth` route pointing to `Auth` (back-compat).

## 6. Dashboard fallback — `src/pages/Dashboard.tsx`
Today it queries `callcapture_clients` by `user_id` only. Add an email fallback for users who paid before the user_id link was set:
- After the `user_id` query, if `data` is null and `user.email` exists, query by `ilike("email", user.email)` (limit 1, newest).
- If that returns a row whose `user_id` is null, update it: `update({ user_id: user.id }).eq("id", row.id)`. Then use that row.
- This belt-and-suspenders covers anyone whose row pre-exists (the trigger normally handles this on user insert, but this guarantees recovery for already-created users).

The polling logic, status badge, and "checkout=success" toast all stay.

## 7. Cleanup
- Remove the magic-link "no password needed" copy from Auth — the new copy is the standard sign-in form.
- No change to Stripe checkout, webhook, Vapi, Twilio, SMS, or lead capture.
- No DB migrations. RLS on `callcapture_clients` already supports anon insert, owner select/update by `user_id`, and the email-link triggers stay in place as a safety net.

## Files touched
- `src/components/SiteNav.tsx` — Login button, signed-in state.
- `src/pages/Start.tsx` — password fields, `signUp`, link-existing-row logic.
- `src/pages/Auth.tsx` — rewrite to email/password + forgot-password.
- `src/pages/ResetPassword.tsx` — new page.
- `src/App.tsx` — add `/login` and `/reset-password` routes.
- `src/pages/Dashboard.tsx` — email-fallback client lookup with auto-link.

## Out of scope
- Re-enabling magic link (you said "we can add it later").
- Google sign-in.
- Custom email templates for the password-reset email (Supabase default is fine for now).
