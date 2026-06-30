## Problem

`PhoneNumberPicker` hard-blocks every action with the toast **"Account not ready. Complete signup before connecting a number."** whenever `clientId` is `null`. During Concierge/Setup, that can happen even though the user is authenticated, because no row in `callcapture_clients` exists yet (or the row exists but isn't linked to `auth.uid()`). The picker should self-heal instead of bouncing the user.

## Fix

### 1. Add a workspace initializer hook — `src/setup/useEnsureClient.ts` (new)

A single async helper that the picker (and any other onboarding surface) can call to guarantee a usable `client_id` before performing a Twilio purchase / link.

Steps inside `ensureClient()`:

1. `supabase.auth.getUser()` — require a session; if missing return `{ ok: false, code: "not_authenticated" }`.
2. Look up an existing row in `callcapture_clients` by `user_id`, then by `lower(email)`. If found but `user_id` is null, patch it with the current uid.
3. If no row exists, call the existing `signup-tenant` edge function (it already creates the tenant row with service role and bypasses RLS). Pass the authed user's email + a minimal `business_name` fallback (`"My Business"` or the email local-part). On success it returns the new `client_id`.
4. Ensure required onboarding scaffolding exists on the row by writing safe defaults only when null: `onboarding_state` (empty object), `concierge_state` left alone, `setup_step` (0 if null). No overwrites of user data.
5. Fire-and-forget `supabase.functions.invoke("update-vapi-agent", { body: { client_id }})` so a default Vapi assistant exists; failure does NOT block — it's surfaced as a warning only.
6. Return `{ ok: true, clientId }` or `{ ok: false, code, message }` with the real backend error string for display.

The hook exposes `{ ensureClient, initializing, lastError }` so callers can render state.

### 2. Update `src/components/PhoneNumberPicker.tsx`

- Accept new optional props: `onEnsureClient?: () => Promise<{ ok: boolean; clientId?: string; message?: string }>` and `initializing?: boolean`.
- Replace the `ensureClient()` early-return-and-toast pattern. New flow inside `purchase()` and `linkExisting()`:
  1. If `clientId` is already set → proceed as today.
  2. Else if `onEnsureClient` is provided → `await onEnsureClient()`. On success, continue with the returned `clientId`. On failure, set `error` to:
     > "We need to finish initializing your workspace before connecting this number. Retry setup initialization."
     and remember the underlying backend message in a secondary state (`initError`) for the inline detail.
  3. Else (legacy callers without the prop) → keep current behavior.
- Replace the existing inline error banner with one that, when `initError` is present, also renders a **"Retry Setup Initialization"** button that re-invokes `onEnsureClient` and, on success, automatically retries the pending action (number purchase / link) the user just clicked. Show the raw backend error/field name beneath the button so the missing piece is visible.
- Remove the "Account not ready" toast entirely.

### 3. Wire it into the existing phone step — `src/setup/steps.tsx` (`Step3PhoneNumber`)

- Use `useEnsureClient()` and pass `onEnsureClient` + `initializing` into `<PhoneNumberPicker>`.
- After a successful `ensureClient()` that produced a new id, call `reload()` from `useSetupData` so the rest of the wizard sees the new `clientId`. (Add `reload` to `StepProps` — already returned by `useSetupData`.)

### 4. Concierge surface

The Concierge currently has no phone-number section, but the user is on `/setup`. To make the same flow reachable from Concierge later, export `Step3PhoneNumber` is enough — no Concierge change needed in this pass. (Call out in summary.)

## Out of scope / unchanged

- `signup-tenant`, `provision-twilio-number`, `link-existing-number`, RLS, and the SMS flow are untouched.
- The wizard's "Next" gating remains: number must be assigned before advancing past the phone step.

## Files touched

- `src/setup/useEnsureClient.ts` (new)
- `src/components/PhoneNumberPicker.tsx` (props + error UX + retry)
- `src/setup/steps.tsx` (`Step3PhoneNumber` wiring)
- `src/setup/schema.ts` or step prop type — minor: add optional `reload` to `StepProps` if not already present
