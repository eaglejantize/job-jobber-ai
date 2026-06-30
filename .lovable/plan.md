## Sprint: Activation Stamp + Clean User QA

### 1. Google Calendar connection stamp

**Find the OAuth callback handler** (likely `supabase/functions/google-calendar-callback/` or similar) and on successful token exchange:

```ts
await supabase
  .from("callcapture_clients")
  .update({ google_calendar_connected_at: new Date().toISOString() })
  .eq("id", clientId);
```

**Frontend refresh** — in the Integrations tab / Concierge calendar step, after the OAuth popup returns:
- Invalidate the React Query key for the current client (`["client", clientId]` or equivalent used in `useOnboardingStatus`).
- Re-run `deriveOnboardingStatus()` in `src/onboarding/status.ts` so the Calendar item flips to Complete and `ProgressPanel` updates without a manual refresh.

### 2. Test call success stamp

In `supabase/functions/place-test-call/index.ts` (and/or the Vapi call-end webhook path in `vapi-webhook`), when the test call ends with a successful status:
- Detect the call originated from `place-test-call` (use metadata `{ source: "test_call" }` set at call creation time).
- On `status === "ended"` with successful end reason (`customer-ended-call`, `assistant-ended-call`, duration > N seconds), update:

```ts
test_call_passed_at: new Date().toISOString()
```

**Frontend**: `TestCallButton.tsx` already polls call status — when it sees success, invalidate the client query so `ProgressPanel` updates. Remove the manual "Mark complete" button / checkbox from the Test Call step in `src/concierge/SectionRenderer.tsx` and from `src/onboarding/sections.ts` definitions.

### 3. Clean user QA

Run a full end-to-end test by creating a brand-new auth user with zero rows in `callcapture_clients`.

Walk through:
1. Signup at `/auth`
2. Land on `/setup` (OnboardingGate routes new users here)
3. Phone picker step — verify `useEnsureClient` self-heals and creates the client row
4. Buy/connect a Twilio number
5. Services step
6. Hours step
7. Voice picker
8. Greeting
9. Knowledge base
10. Test call (verify auto-stamp from step 2)
11. Activate (Go Live) button enables and Sync-to-Vapi succeeds

For each step return one of: **Passed / Failed / Fixed / Still blocked** with the specific error and file touched if a fix was needed.

### Technical notes

- The Calendar OAuth callback may be a Supabase Edge Function or a frontend `/auth/google-calendar/callback` route — I will locate and patch whichever exists.
- The `place-test-call` function should attach `metadata.source = "test_call"` on the Vapi call payload so `vapi-webhook` can recognize and stamp it.
- Both stamps should be idempotent (only set if currently null, or always overwrite — confirm preference; default: only set if null to preserve first-success timestamp).
- No schema changes needed — both columns already exist.

### Deliverables

- Patched calendar callback + frontend refresh
- Patched `place-test-call` / `vapi-webhook` test-call stamp + removed manual mark-complete UI
- QA report with Pass/Fail/Fixed/Blocked per step
