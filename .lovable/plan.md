## Goal
Merge the standalone "Google Business Profile" wizard step into Step 1 "Business Profile", so users search/import Google Business data alongside name, phone, address, and website — with no separate step.

## Changes

### 1. `src/concierge/sections.ts`
- Remove the `"google_business"` entry from `SectionId` union and from the `SECTIONS` array.
- Extend the `business_profile` section's `fields` list to also include Google-imported fields (`google_place_id`, `google_category`, `google_rating`) so progress and diffing still track them.
- Keep step order: Business Profile → Services → Hours → Website Import → Knowledge → AI Receptionist → Integrations → Test Call → Review.

### 2. `src/concierge/SectionRenderer.tsx`
- In the `business_profile` case, render `<GoogleBusinessSection ctx={ctx} />` at the top of the section (above the name/phone/email/address/website inputs) so a successful lookup prefills those fields.
- Delete the standalone `case "google_business":` branch.
- Leave the `GoogleBusinessSection` component itself unchanged (still imported, still writes to `address`, `website`, `business_phone`, `google_place_id`, etc.).

### 3. `src/onboarding/status.ts`
- Remove `"google_business"` from the `StepId` union, `STEP_LABELS`, and `CANONICAL_ORDER`.
- Fold the existing `gbpOk` completion signal into the `business_profile` step's completion check (i.e. business_profile is complete when the core fields are filled **and/or** a Google Business Profile has been linked — keeping current activation requirements intact).
- Remove the `google_business` entry from the returned status map so the sidebar no longer lists it.

### 4. No other files
- `useSetupData.ts`, `setup/steps.tsx`, `setup/schema.ts` are the legacy `/setup` wizard (now redirected). Not touched in this change.
- No DB, edge-function, or auth changes.

## Result
Business Profile step shows a "Import from Google Business Profile" search at the top; picking a result fills the fields below. The wizard's left rail loses the separate Google Business step, dropping the canonical step count from 10 to 9. Progress % updates accordingly.