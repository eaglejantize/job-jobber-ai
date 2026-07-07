## Problem

The Settings page renders the Concierge flow (`src/concierge/ConciergePage.tsx`), not the legacy `BusinessTab`. In `src/concierge/SectionRenderer.tsx`, the `business_profile` case only renders name / phone / email / address / website inputs. The `IndustryCombobox` exists in the file (under an unused `case "industry"` branch) but no section has id `"industry"`, so it never renders.

`industry` and `business_category_group` are already listed in the `business_profile` section's `fields` array (`src/concierge/sections.ts`) and are still written to `callcapture_clients`, so only the UI is missing.

## Change

In `src/concierge/SectionRenderer.tsx`, inside the `case "business_profile"` block, add an Industry field below Website that renders `<IndustryCombobox>` bound to `industry` / `business_category_group` via `ctx.setField` (mirroring the existing dead `case "industry"` branch). Show a small "Group: …" hint under it when a category group is resolved via `findIndustryGroup`, matching the style used in `BusinessTab`.

Leave the dead `case "industry"` branch in place (harmless) or remove it — not required for the fix.

## Out of scope

- No schema/RLS/backend changes.
- No changes to `BusinessTab`, sections list, prompt generation, or agent config logic.
- No visual redesign beyond adding the one field.

## Verification

Load `/settings` → Business Profile step shows the Industry dropdown populated from current value; changing it updates pending state and Save persists `industry` + `business_category_group` to `callcapture_clients`.
