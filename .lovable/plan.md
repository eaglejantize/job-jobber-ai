## Plan

1. Force one canonical setup config for every account type
   - Make `/settings` always render the same canonical 10-step `SECTIONS` list for subscribers and admins.
   - Add a guard/assertion in the wizard so if `phone_number` is missing from the loaded section list, it is inserted at step 4 before rendering.
   - Do not create a duplicate phone flow; use the existing `PhoneNumberPicker` / `PhoneNumberSection`.

2. Fix subscriber state loading
   - Normalize each subscriber’s saved `concierge_state` on load so old 9-step saved state cannot produce a 9-step subscriber wizard.
   - If the saved state predates the phone-number step, remap old step indexes so the flow becomes:
     `Business Hours -> Business Phone Number -> Website Import`.
   - Remove any stale `skipped` state for `phone_number`.

3. Fix onboarding checklist state
   - Normalize `onboarding_state.items` so every subscriber has `phone_number` in the checklist.
   - Set `phone_number` to incomplete when `assigned_callcapture_number` is null.
   - Set it complete only when a number is assigned.
   - Prevent setup completion/activation if a subscriber has no `assigned_callcapture_number`.

4. Backfill existing subscriber accounts
   - Update existing non-admin subscriber rows that still have old 9-step state.
   - Ensure those rows get `phone_number` inserted as incomplete unless they already have a number.
   - Clear completion markers from non-admin subscribers that were marked complete without a phone number.

5. Verify specifically as a non-admin subscriber
   - Create or use a brand-new non-admin subscriber account with no assigned number.
   - Sign in as that subscriber and open `/settings`.
   - Confirm the left step list shows all 10 steps, including `4. Business Phone Number`.
   - Confirm the actual phone setup UI appears: new number / existing number / forward / test number.
   - Confirm the subscriber cannot activate without selecting/linking a number.

6. Publish after verification
   - Publish the verified fix so production subscribers receive the same phone setup step as the admin preview.