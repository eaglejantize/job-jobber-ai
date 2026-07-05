## Goal
When a user clicks "Skip" on a skippable setup step (e.g. Test Call), that skip should count as step completion so activation isn't blocked. Right now Skip only stores the section id in the concierge's local `skipped[]` — it never marks the underlying onboarding item as skipped, and `isReadyToActivate` treats "skipped" as incomplete for required items like `test_call`. Result: a dummy account can't activate because it can't place a real test call.

## Changes

### 1. `src/onboarding/status.ts`
- Add a `SKIPPABLE_FOR_ACTIVATION: ItemId[]` list containing the required items where a user-initiated skip should satisfy activation. Include `test_call` (primary case). Leave `business_info`, `services`, `hours`, `ai_receptionist` as non-skippable (real config required).
- Update `isReadyToActivate` so an item counts as satisfied when its status is `complete` **or** (`skipped` **and** the id is in `SKIPPABLE_FOR_ACTIVATION`).
- `progressSummary` already counts `skipped` — leave unchanged.

### 2. `src/concierge/ConciergePage.tsx`
- Map `SectionId` → `ItemId` (`business_profile→business_info`, `knowledge→knowledge_base`, others 1:1; `review` has no mapping).
- In `skip()`, after `ctx.skipSection(section.id)` and before advancing, also persist the onboarding item status: call the same update path used by `useOnboardingState.markStatus` so `callcapture_clients.onboarding_state.items[itemId] = { status: "skipped", updated_at: … }`. Easiest wiring: instantiate `useOnboardingState` in `ConciergePage` and call `onboarding.markStatus(itemId, "skipped")` inside `skip()`, then `await onboarding.reload()` so the Review checklist reflects it immediately.
- Update the Skip button label/tooltip on `test_call` to make clear skipping is allowed ("Skip — I'll test later"). Cosmetic only.

### 3. `src/concierge/ReviewAndApply.tsx`
- Update the activation checklist row rendering so an item shows a green check when its status is `complete` **or** `skipped` (for skippable required items). Use the same `SKIPPABLE_FOR_ACTIVATION` list from `status.ts`. Add a small "Skipped" label next to the check for clarity.
- No change to the activate button gating logic — it already reads `onboarding.readiness.ready`, which now returns true when `test_call` is skipped.

### 4. No DB migration
The `onboarding_state` JSON column already supports arbitrary item statuses; no schema changes needed. No edge-function changes.

## Result
- User clicks Skip on Test Call → onboarding item marked `skipped` → activation checklist shows Test Call as satisfied → "Activate My AI Receptionist" enables. Dummy accounts (and any customer without desktop calling) can complete setup.
- Skipping the four truly-required items (business info, services, hours, AI receptionist) still blocks activation, so we don't let people launch an unconfigured receptionist.
