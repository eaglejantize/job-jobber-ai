# White-screen after sign-in — root cause and fix

## What's happening

Reproduced in a headless browser signed in as an authed user: every protected route (`/home`, `/dashboard`, `/settings`, `/settings/concierge`, `/leads`) renders a completely empty `#root` (only the toaster is there). No JS errors are thrown — the app renders literally nothing.

The cause is a self-redirect loop inside `OnboardingGate`:

- `App.tsx` wraps `/settings/concierge` with `<RequireAuth><OnboardingGate><Concierge /></OnboardingGate></RequireAuth>`.
- For any user whose `onboarding_completed_at` and `launched_at` are both null (i.e. every brand-new signup, plus anyone whose onboarding isn't marked complete yet), `OnboardingGate` returns `<Navigate to="/settings/concierge" replace />`.
- Because the current URL is already `/settings/concierge`, React Router treats this as a no-op navigation. `<Navigate>` renders `null`, so the route renders nothing → white screen.
- The same gate is on `/dashboard`, `/home`, `/settings`, `/leads`, so those all redirect into the broken concierge route and also go blank.

`/setup` is not wrapped in `OnboardingGate`, which is exactly why it still renders — that's the smoking gun.

## Fix

1. **Do not gate the onboarding destinations with `OnboardingGate`.**
   In `src/App.tsx`, remove `<OnboardingGate>` from the `/settings/concierge` route (and, for the same reason, remove it from `/setup` if it's ever added — currently it isn't). The concierge/setup pages are the onboarding flow; they must always render for signed-in users.

2. **Belt-and-braces guard in `OnboardingGate`** (`src/components/OnboardingGate.tsx`):
   before returning `<Navigate to="/settings/concierge" />`, check `useLocation()` and short-circuit to `children` if the current pathname is already `/settings/concierge` or `/setup`. This prevents the same class of bug if the gate is ever added to another onboarding route in the future.

3. **No database or backend changes.** The data is fine; the bug is purely in the route wiring.

## Verification

After the change, re-run the Playwright probe against `/settings/concierge`, `/dashboard`, `/home`, `/settings`, and `/leads` while signed in and confirm each renders real content instead of an empty `#root`. Then sign in through the UI as `eaglejantize@gmail.com` (already flipped to super admin) and confirm the Admin link is visible and the dashboard loads.

## Out of scope

- No changes to auth, Supabase schema, RLS, or the concierge/setup content itself.
- The existing super-admin restore for `eaglejantize@gmail.com` stays as-is.
