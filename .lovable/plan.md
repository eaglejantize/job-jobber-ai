# Fix wizard prefill leaking across accounts

The wizard fills business name / email / phone / owner name from two sources, and both can carry the super admin's data into a fresh subaccount session:

1. `src/pages/Setup.tsx` line 76 reads the user's most recent `callcapture_clients` row and copies `business_name`, `email`, `alert_phone`, `owner_name` into wizard state.
2. `src/lib/wizardSchema.ts` persists wizard state to `localStorage["callcapture.wizard"]` with no user scoping, so anything the super admin typed in the same browser sticks around for the next account.

The area code input also shows a hardcoded sample (`"904"`) instead of a real placeholder.

## Changes

### `src/pages/Setup.tsx`
- Delete the prefill effect (lines 71–94) that pulls business_name / email / alert_phone / owner_name from `callcapture_clients`. New subaccounts start blank.
- Keep `clientId` lookup only if needed downstream — it isn't used anywhere else, so remove `clientId` state entirely.
- Add a user-scoping guard: after `supabase.auth.getUser()`, compare the signed-in user id with a stored `callcapture.wizard.owner` key in localStorage. If they differ (or no signed-in user), call `clearWizardState()`, clear `callcapture.wizard.step`, reset `state` to `defaultWizardState`, and write the new owner id. This prevents any prior account's typing from bleeding through.

### `src/lib/wizardSchema.ts`
- Export a small helper `setWizardOwner(userId: string | null)` that writes `callcapture.wizard.owner` and a `getWizardOwner()` reader. Used by the Setup guard above.

### `src/pages/Start.tsx` (signup)
- After successful signup + sign-in, call `clearWizardState()` and remove `callcapture.wizard.step` / `callcapture.wizard.owner` so the first visit to `/setup` for the new account is guaranteed clean. This is belt-and-suspenders with the Setup guard.

### `src/components/PhoneNumberPicker.tsx`
- Change the area code `<Input>` placeholder from `"904"` to `"Preferred area code"`.

## Out of scope
- Defaults for non-identity fields (assistant name "Riley", greeting, tone, intake questions, primary treatments) stay as-is — the user listed only business name, email, phone, area code as the leak.
- No DB or edge-function changes.

## Files touched
- `src/pages/Setup.tsx`
- `src/lib/wizardSchema.ts`
- `src/pages/Start.tsx`
- `src/components/PhoneNumberPicker.tsx`
