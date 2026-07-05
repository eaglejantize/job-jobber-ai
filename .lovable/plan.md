## Goal

New subscribers should land on **Step 1 (Business Profile)** when they open setup — not jump straight to Step 4 (Business Phone Number). Step 4 stays present and still cannot be skipped, but users get to walk the wizard from the beginning.

## Changes

### `src/concierge/useConcierge.ts`
- Remove the `needsPhoneNumberStep(row)` forced-routing logic in `load()`.
- When a subscriber has no saved `concierge_state`, do **not** write an initial state pinned to `PHONE_NUMBER_STEP_INDEX`. Let step default to `0`.
- Keep `normalizeConciergeState` (schema migration + old-step shifting) so returning users still land on the correct saved step.
- Keep `PHONE_NUMBER_STEP_INDEX` constant only if still referenced elsewhere; otherwise drop it.

### `src/concierge/ConciergePage.tsx`
- No change to the guard behavior on the phone step itself:
  - Next button stays disabled when on Step 4 without an assigned number.
  - Skip button stays disabled on Step 4.
  - Sidebar nav still allows visiting Step 4 directly.
- No visual/layout changes.

### Database backfill (one-shot)
- For existing non-admin subscriber rows whose `concierge_state.step = 3` was written by the previous forced-step logic **and** who have not otherwise progressed (`pending` empty, `skipped` empty), reset `concierge_state.step` to `0` so they also start at Step 1 next time they open setup.
- Do not touch rows where the user has legitimately advanced past Step 1.

## What stays the same

- Step 4 (Business Phone Number) remains in the canonical 10-step flow via `ensurePhoneNumberSection`.
- Activation is still blocked until a phone number is assigned.
- `onboarding_state.items.phone_number` normalization is unchanged.

## Verification

1. Create a fresh non-admin subscriber account.
2. Open `/settings` → confirm it opens on **Step 1: Business Profile**.
3. Click through to Step 4 → confirm the phone picker renders and Next/Skip are disabled until a number is chosen.
4. Confirm activation still blocked without a number.
