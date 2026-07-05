## Findings

- `/settings` uses the unified `ConciergePage` for all authenticated users; I found no role/plan/feature-flag filtering around `SECTIONS`.
- Published assets currently include `phone_number` and `Business Phone Number`, so production does not look obviously stale at the bundle level.
- The likely remaining bug is persisted state: tenant/subscriber rows can keep old `concierge_state.step` and old `onboarding_state.items` from the 9-step flow. The current code clamps numeric step only, so an old step after Business Hours now points to Website Import instead of being remapped to the inserted phone step.
- `onboarding_state.items` is derived from canonical `ITEM_ORDER` at runtime, but the saved object is never normalized back to the database, so old rows can remain missing `phone_number`.
- The phone number UI itself is not hidden when `assigned_callcapture_number` is null; it renders the picker in that state.

## Plan

1. Add canonical onboarding normalization
   - In `src/onboarding/status.ts`, add a normalizer that always returns all canonical `ITEM_ORDER` items.
   - If saved `onboarding_state.items.phone_number` is missing, insert it as `not_started` unless `assigned_callcapture_number` makes it complete.
   - Keep `phone_number` required for activation and ensure skipped phone setup does not satisfy activation.

2. Add concierge step migration/remapping
   - In `src/concierge/useConcierge.ts`, normalize saved `concierge_state` when loading.
   - Detect the old 9-step flow and remap stored steps at/after the insertion point so old tenants do not jump from Business Hours to Website Import.
   - Clamp to the current 10-step canonical `SECTIONS` length.
   - Persist the normalized `concierge_state` back to the tenant row only when it differs.

3. Backfill existing tenants
   - Add a database update that normalizes existing `callcapture_clients.onboarding_state` and `concierge_state` rows:
     - add missing `phone_number` item as incomplete when no number exists;
     - mark it complete when `assigned_callcapture_number` exists;
     - remap old `concierge_state.step` values to the closest valid current step.
   - Do not mark setup complete from this migration.

4. Verify with a brand-new non-admin subscriber tenant
   - Use a non-admin/trial subscriber tenant in the backend (or create a disposable one if needed), sign in through the app, and open `/settings`.
   - Confirm the wizard shows exactly 10 steps in this order:
     1. Business Profile
     2. Services
     3. Business Hours
     4. Business Phone Number
     5. Website Import
     6. Knowledge Base
     7. AI Receptionist
     8. Integrations
     9. Test Call
     10. Review & Activate
   - Confirm `Business Phone Number` appears incomplete when `assigned_callcapture_number` is null.
   - Confirm activation remains disabled until that step is complete.

5. Production freshness check
   - After implementation, publish if needed and confirm the published bundle contains the normalized 10-step flow.
