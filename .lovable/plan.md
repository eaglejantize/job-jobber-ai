## Problem

1. **After login you land on `/dashboard`**, not `/home`. The default post-auth redirect is hardcoded to `/dashboard` in `route-guards.tsx`, `Auth.tsx`, `Start.tsx`, `ResetPassword.tsx`, `SiteNav.tsx`, and the concierge finish flows.
2. **`/home` bounces to `/settings`.** `/home` is wrapped in `OnboardingGate`, which force-redirects to `/settings` whenever onboarding isn't fully complete. That's wrong — onboarding completeness should only drive a "setup not complete" indicator in the UI, never block navigation.

## Plan

### 1. Stop onboarding from blocking any page

`OnboardingGate` should never redirect. Onboarding state is a UI signal (a badge / banner / setup card), not a route guard.

- Remove `OnboardingGate` wrappers from all routes in `src/App.tsx` (`/home`, `/dashboard`, `/leads`).
- Delete `src/components/OnboardingGate.tsx` (and its import in `App.tsx`) since it no longer has a caller.
- Keep the existing in-page setup-progress UI on Home / Dashboard so incomplete accounts still see a clear "setup not complete — finish setup" call to action linking to `/settings`. No visual redesign — just make sure the existing progress card / badge still renders for incomplete accounts on Home. If Home doesn't already show one prominently, add a small banner at the top using existing `SetupProgressBadge` + a link to `/settings`.

Auth guards (`RequireAuth`) stay exactly as they are — signed-out users still get sent to `/login`.

### 2. Make `/home` the default landing page

Change the post-login default destination from `/dashboard` to `/home` in every place that picks a fallback route:

- `src/components/route-guards.tsx` — `RedirectIfAuthed` fallback → `/home`
- `src/pages/Auth.tsx` — `nextTarget` fallback → `/home`
- `src/pages/Start.tsx` — post-signup redirect → `/home`
- `src/pages/ResetPassword.tsx` — post-reset redirect → `/home`
- `src/concierge/ConciergePage.tsx`, `src/concierge/PostApply.tsx` — finish redirects → `/home`
- `src/components/settings/PhoneSetupWizard.tsx` — completion redirect → `/home`
- `src/components/SiteNav.tsx` — the two "go to app" CTAs → `/home`
- `src/components/landing/Navbar.tsx` — the "Dashboard" CTA links → `/home`

`/dashboard` stays a valid route and stays in `AppNav` — it just isn't the default landing anymore.

### 3. Out of scope

- No changes to onboarding derivation logic (`src/onboarding/status.ts`), the concierge, RLS, or backend.
- No changes to the MCP / AI Integrations work.
- No visual redesign of Home, Dashboard, or Settings beyond ensuring the setup-progress indicator is visible on Home.

### Verification

Playwright run against `http://localhost:8080`:
- Sign in as an account with incomplete onboarding, confirm landing URL is `/home` and the page renders (not `/settings`).
- Navigate directly to `/home`, `/dashboard`, `/leads` — all render without redirecting to `/settings`.
- Confirm Home shows a visible "setup not complete" indicator with a link to `/settings`.
- Sign out and hit `/home` — still redirects to `/login` (auth guard unchanged).