## Findings

The reported tenant shows the exact stuck state:

- Number was purchased and saved: `+17045047944`
- `number_status = needs_configuration`
- `webhook_status = pending`
- `vapi_assistant_id = null`
- `vapi_phone_number_id = null`
- Activation was still marked complete

Recent backend logs show the provisioning failure:

```text
assistant create failed (400): Couldn't Find 11labs Voice
```

The fresh account selected `voice_id = noah`, but the current voice picker stores app placeholder IDs like `noah`, `maya`, etc. The provisioning backend sends those as ElevenLabs voice IDs, so provider assistant creation fails. Because onboarding currently treats “assigned phone number exists” as complete, the tenant can activate even though routing never finished.

## Plan

1. **Fix the root provisioning failure**
   - Stop sending placeholder app voice IDs to the provider as ElevenLabs voice IDs.
   - Add a safe voice resolver in phone provisioning/repair code:
     - Use provider-native default voice when the stored voice is one of the app placeholder/persona IDs.
     - Only send ElevenLabs voice payloads when the ID is a real external voice ID.
   - Apply this to both `provision-twilio-number` and `repair-routing` so stuck tenants can be repaired with the same logic.

2. **Make phone provisioning atomic and observable**
   - In `provision-twilio-number`, log each step with structured context:
     - number selected
     - Twilio purchase
     - assistant create/update
     - provider phone registration
     - webhook/TwiML fallback update
     - database save
     - final activation
   - Store user-visible provisioning failures on the tenant row using existing fields where possible (`last_vapi_sync_status`, `last_vapi_sync_at`, `webhook_status`, `number_status`).
   - Also write step diagnostics into the existing `callcapture_webhook_events` table using steps like `phone_purchase`, `assistant_upsert`, `provider_register`, `webhook_configured`, `phone_ready`, `phone_failed`.

3. **Add automatic retries for transient provider failures**
   - Add a small retry helper with exponential backoff for provider calls that can transiently fail.
   - Retry network failures, timeouts, and 429/5xx responses.
   - Do not retry permanent 400 validation errors like invalid voice IDs; show the actual error and mark provisioning failed.

4. **Remove indefinite “Needs Configuration” UI**
   - Update `PhoneNumberPicker` so pending/error states show actual routing details instead of the generic “Routing setup will be completed shortly.”
   - Add automatic refresh/polling while the number status is provisioning/pending/needs configuration.
   - Show clear success when `number_status = active` and `webhook_status = configured`.
   - Show a retry/repair action when provisioning failed or is stuck.

5. **Synchronize activation gating with real phone readiness**
   - Change onboarding status derivation so phone setup is not complete merely because `assigned_callcapture_number` exists.
   - For newly provisioned numbers, require:
     - assigned number exists
     - `number_status = active`
     - `webhook_status = configured`
     - provider phone ID exists
     - assistant ID exists
   - Prevent activation until those are true.
   - If a stale account has `activated_at`/`onboarding_completed_at` but phone provisioning is incomplete, normalize it back to incomplete so the gate catches it.

6. **Repair the known stuck tenant safely**
   - After code changes, run the repair path for the tenant with `(704) 504-7944`.
   - Confirm it either becomes active/configured or stores a real actionable error.
   - Do not leave it in generic pending state.

7. **Review fresh-account onboarding end to end**
   - Verify a fresh tenant starts at step 1.
   - Confirm the sequence remains visible and consistent:
     - Welcome/setup entry
     - Business information
     - Business hours
     - Phone number selection
     - Google Business import
     - Website import
     - AI voice setup
     - Activation
   - Confirm no step can be skipped/hidden in a way that bypasses required phone provisioning.

8. **Reduce future regressions by consolidating source of truth**
   - Keep `deriveOnboardingState` as the authority for activation readiness.
   - Ensure `ConciergePage`, `OnboardingGate`, progress UI, and activation checklist all rely on that same derived readiness.
   - Remove or neutralize old/orphaned phone setup activation logic that can mark tenants active without real provisioning.