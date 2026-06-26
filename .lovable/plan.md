
## Goal

Turn the existing 8-step `/setup` wizard into a true first-time-user onboarding flow: detect incomplete setup, force a guided experience from a welcome screen through go-live, then drop users into the operational dashboard. Surface progress everywhere via a persistent indicator.

## What already exists (reuse, don't duplicate)

- `src/setup/SetupContainer.tsx` — 8-step wizard with progress bar and Launch flow.
- `src/setup/schema.ts` — `SetupData` covering business info, number, voice, script, call handling, notifications.
- `callcapture_clients.setup_step`, `launched_at` columns drive completion state.
- `src/components/TestCallButton.tsx` + `place-test-call` edge function — real outbound Vapi call.
- `Dashboard.tsx` already loads the user's client row on mount.

## Changes

### 1. Onboarding completion model

Add to `callcapture_clients` (migration):
- `onboarding_completed_at timestamptz`
- `crm_provider text` (nullable; `'servanahq' | 'none' | null`)
- `crm_connected_at timestamptz`
- `first_test_call_id uuid` (nullable, references the call from `callcapture_calls` captured during the test step)

`onboarding_completed_at` is the single source of truth for "done". `launched_at` keeps its existing meaning (assistant pushed to Vapi).

### 2. Expand the wizard from 8 → 10 steps

Update `src/setup/schema.ts` `STEPS` and add two new step components in `src/setup/steps.tsx`:

```text
0  Welcome              (new)        — brand intro, "what we'll set up", Start button
1  Find your business
2  Business details
3  Vektuor number
4  AI voice
5  Script
6  Call handling        — already covers greeting/hours/forwarding/voicemail/SMS fallback
7  SMS & notifications
8  Connect your CRM     (new)        — ServanaHQ primary; Housecall Pro / Jobber / ServiceTitan as "Coming soon"; "Skip for now"
9  Test call            (new)        — embeds TestCallButton, polls callcapture_calls for the resulting call, shows live transcript + captured lead (reuses ActiveCallPanel/IntakePanel pieces or a compact version)
10 Go live              — replaces the current launched screen: completion checklist (number provisioned ✓, voice set ✓, script saved ✓, notifications ✓, CRM ✓/skipped, test call placed ✓), single "Go Live" button that sets `onboarding_completed_at`, calls `update-vapi-agent`, then navigates to `/dashboard`
```

Step 8 (CRM) writes `crm_provider` only; an actual ServanaHQ integration is out of scope for this turn — we capture intent and show a "Connect later from Settings" note. Other CRMs render as disabled cards with a "Notify me" toggle stored on `crm_provider = null` + a `crm_interest text[]` column (added in the migration).

### 3. Force first-time users into the wizard

Create `src/components/OnboardingGate.tsx`:
- Reads the signed-in user's client row (`setup_step`, `onboarding_completed_at`).
- If row missing or `onboarding_completed_at IS NULL`, `<Navigate to="/setup" replace />`.
- Otherwise renders children.

Wrap the protected operational routes (`/dashboard`, `/home`, `/leads`, `/settings`) in `App.tsx` with `OnboardingGate` (inside the existing `RequireAuth`). `/setup` itself stays ungated.

After the wizard's Go Live action runs, `SetupContainer` navigates to `/dashboard`; gate now passes.

### 4. Persistent Setup Progress indicator

New component `src/components/SetupProgressBadge.tsx`:
- Subscribes to the current client row.
- Computes percent from `setup_step` / total steps (or 100% when `onboarding_completed_at` is set).
- Renders a compact pill in `AppNav.tsx` (top nav, right side, before user menu): `Setup 60% · Resume →` linking to `/setup?step=N`. Hidden when complete.
- Also renders an inline banner version at the top of `/dashboard`, `/home`, `/leads` when incomplete (in case a user lands there via deep link before the gate ever mounts).

`SetupContainer` reads `?step=N` to resume at the right step.

### 5. Welcome + Go-Live screens

- Welcome (step 0): full-bleed dark card, headline ("Let's get your AI receptionist live in ~10 minutes"), 6-bullet roadmap, primary "Get started" button, secondary "Skip to dashboard" hidden (we want the gate to hold them).
- Go Live (step 10): checklist derived from `SetupData` + DB flags. Each row green-check or amber-warn with "Fix" link jumping back to that step. Single CTA "Go Live" disabled until required items pass (number, voice, greeting, notifications). CRM and test call are recommended but skippable.

### 6. Edge function tweaks

- No new edge functions required for the core flow.
- The test-call step relies on `place-test-call` + existing `vapi-webhook` ingestion into `callcapture_calls` / `callcapture_transcript_turns`. The step polls `callcapture_calls` filtered by `client_id` and `created_at > step_entered_at` to pick up the just-placed call, then stores its id in `first_test_call_id`.

### 7. Files touched

```text
supabase/migrations/<ts>_onboarding_state.sql   (new)
src/setup/schema.ts                             (STEPS, SetupData additions for crm_provider, crm_interest)
src/setup/steps.tsx                             (Step0Welcome, Step8Crm, Step9TestCall, Step10GoLive; renumber)
src/setup/SetupContainer.tsx                    (welcome handling, ?step= resume, go-live writes onboarding_completed_at, navigates to /dashboard)
src/setup/useSetupData.ts                       (load/save new fields)
src/components/OnboardingGate.tsx               (new)
src/components/SetupProgressBadge.tsx           (new — pill + banner exports)
src/components/AppNav.tsx                       (mount pill)
src/pages/Dashboard.tsx, Home.tsx, LeadInbox.tsx (mount banner)
src/App.tsx                                     (wrap protected routes in OnboardingGate)
```

### 8. Out of scope (call out to user)

- Real ServanaHQ API integration — this turn only captures intent.
- Reworking `Settings.tsx` accordion (it already mirrors the wizard via the shared step components, so the new steps appear there automatically).
