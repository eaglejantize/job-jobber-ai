# Stripe Redirect Bounce → /setup

## Problem
If Stripe sends a user back to `/start` or `/confirm` (e.g. via `?session_id=…`, `?success=1`, or any Stripe return param), they currently either sit on `/start` or hit a route that doesn't exist. We want them landed on `/setup` quickly, without waiting for any backend payment confirmation.

## Behavior
- On `/start`: if the URL contains a Stripe return signal (`session_id`, `success`, or `checkout_session_id`), wait up to 2 seconds, then redirect to `/setup`, preserving query params.
- On `/confirm`: always redirect to `/setup` after ≤2 seconds, preserving query params. (No payment check, no spinner blocking — just a brief "Redirecting…" message.)
- The `?canceled=1` case on `/start` is unchanged (user stays, sees the cancel toast).
- `/setup` itself is untouched — its existing flow can still read `session_id` if present, but nothing here blocks on it.

## Changes

### 1. `src/pages/Start.tsx`
Add a `useEffect` that, on mount, checks `searchParams` for `session_id` / `success` / `checkout_session_id`. If found:
- Set a `setTimeout` of 2000 ms that calls `navigate('/setup' + location.search, { replace: true })`.
- Clear the timeout on unmount.
- Optionally render a lightweight "Redirecting to setup…" overlay while waiting, so the form isn't interactive.

### 2. New `src/pages/Confirm.tsx`
Minimal page:
- Shows "Redirecting to setup…".
- `useEffect` schedules `navigate('/setup' + location.search, { replace: true })` after 2000 ms.
- No Supabase calls, no payment lookups.

### 3. `src/App.tsx`
Add route:
```tsx
<Route path="/confirm" element={<Confirm />} />
```
Placed above the catch-all `*`.

## Out of scope
- No edge function changes.
- No change to `create-checkout` success/cancel URLs (they still point at `/setup` and `/start?canceled=1`); this is purely a safety net for the case where Stripe — or a user — lands somewhere else.
- No change to `/setup`'s confirmation logic.
