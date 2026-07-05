# Restore the Business Phone step in onboarding

## Diagnosis

The Business Phone step was **removed during the onboarding consolidation**, not just unrouted.

- Live wizard: `/settings` → `ConciergePage` → sections defined in `src/concierge/sections.ts`. That list has no phone step and nothing in `src/concierge/` renders `PhoneNumberPicker` or writes `assigned_callcapture_number`.
- The working phone step still exists but is orphaned in the deprecated `src/setup/` module (`Step3PhoneNumber` in `src/setup/steps.tsx`, gated by `SetupContainer.tsx`). `/setup` now redirects to `/settings`, so it's unreachable.
- `src/onboarding/status.ts` has no `phone_number` item, so activation doesn't require a number. Result: new tenants finish onboarding with `assigned_callcapture_number = null`.

Fix by re-adding the step to the concierge flow and reusing the existing `PhoneNumberPicker` — no duplicate provisioning flow.

## Changes

### 1. New concierge section renderer
Add `src/concierge/sections/PhoneNumberSection.tsx` that:
- Reads `ctx.clientId` and current `assigned_callcapture_number` / `number_status`.
- If a number is already assigned, shows it with a "Replace number" affordance.
- Otherwise renders `<PhoneNumberPicker clientId={ctx.clientId} />` (existing component wired to `search-twilio-numbers` + `provision-twilio-number`).
- On successful provision, updates ctx state so the step flips to "complete" and calls `onboarding.markStatus("phone_number", "complete")`.

### 2. Register the section
`src/concierge/sections.ts`:
- Add `"phone_number"` to `SectionId` and insert a `SectionDef` between `hours` and `website_import` (natural place: after we know the business, before AI voice/greeting).
  - `fields: ["assigned_callcapture_number", "number_status"]`, `aiSupported: false`.
- Add labels for the two fields in `FIELD_LABELS`.

`src/concierge/SectionRenderer.tsx`:
- Add a case for `phone_number` that renders the new component.

### 3. Onboarding status model
`src/onboarding/status.ts`:
- Add `"phone_number"` to `ItemId`, `ITEM_LABELS`, `ITEM_ORDER` (positioned to match section order).
- In `derived()`: `phone_number = nonEmpty(c?.assigned_callcapture_number) ? "complete" : "not_started"`.
- Add `"phone_number"` to `REQUIRED_FOR_ACTIVATION` (do NOT add to `SKIPPABLE_FOR_ACTIVATION` — a working number is mandatory).

`src/concierge/ConciergePage.tsx`:
- Add `phone_number: "phone_number"` to `SECTION_TO_ITEM`.

### 4. Clean up dead code
Delete the orphaned wizard so it can't drift again:
- `src/setup/` directory (Step3PhoneNumber lives here; nothing else references these files except the redirect).
- Confirm the `/setup` → `/settings` redirect in `App.tsx` stays; remove any remaining imports from `src/setup/` if grep finds them.

(If any live code still imports from `src/setup/`, keep those files and only remove `steps.tsx`/`SetupContainer.tsx`/`SetupAccordion.tsx`.)

## Verification

- Manual: sign in as a fresh tenant → wizard shows Phone Number step; picking a number provisions it, `assigned_callcapture_number` is written, checklist item flips to complete, Activate stays blocked until then.
- Existing tenants with a number already assigned: step derives as `complete` immediately, no regression.
- `tsgo` for typecheck.

## Out of scope

- No changes to `provision-twilio-number` / `search-twilio-numbers` edge functions.
- No changes to Home/Dashboard UI that reads `assigned_callcapture_number`.
- No new billing gates.
