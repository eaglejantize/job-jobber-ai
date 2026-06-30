
# Concierge as Onboarding Engine

Make the AI Setup Concierge the single onboarding hub. Reuse every existing settings/wizard module — do not create parallel UIs. Track per-step status in the DB, surface a visual progress tracker, gate "Activate AI Receptionist" on required items, and ship a Go Live readiness screen.

## 1. Onboarding state model

New JSONB column `onboarding_state` on `callcapture_clients`:

```json
{
  "items": {
    "business_info":     { "status": "complete",       "updated_at": "..." },
    "industry":          { "status": "complete" },
    "google_business":   { "status": "skipped" },
    "website_import":    { "status": "in_progress" },
    "hours":             { "status": "complete" },
    "service_areas":     { "status": "not_started" },
    "services":          { "status": "complete" },
    "faqs":              { "status": "needs_attention" },
    "ai_personality":    { "status": "complete" },
    "voice":             { "status": "complete" },
    "greeting":          { "status": "complete" },
    "hours_routing":     { "status": "complete" },
    "after_hours":       { "status": "complete" },
    "call_forwarding":   { "status": "not_started" },
    "voicemail":         { "status": "complete" },
    "sms_fallback":      { "status": "complete" },
    "calendar":          { "status": "not_started" },
    "knowledge_base":    { "status": "in_progress" },
    "test_call":         { "status": "not_started" }
  },
  "activated_at": null
}
```

Status enum (string): `not_started | in_progress | complete | needs_attention | skipped`.

Status is computed from underlying `callcapture_clients` fields by a single pure function `deriveOnboardingStatus(client)` in `src/onboarding/status.ts`, then merged with explicit user overrides (skip, mark complete) persisted in `onboarding_state`. Recompute on every load and after every save so the checklist stays accurate even when fields are edited outside the Concierge.

Required-for-activation set (drives the GO LIVE button):
`business_info, business_phone (vapi_phone_number_id), greeting, voice, hours, ≥1 service, knowledge_source (faqs OR knowledge_base OR services), test_call`.

## 2. Module audit — reuse what exists

| Concierge item | Existing surface to launch | Action |
| --- | --- | --- |
| Business Information | `BusinessTab` + concierge `business_profile` section | Reuse concierge section (already wired) |
| Industry | `IndustryCombobox` in `BusinessTab` / concierge `industry` | Reuse |
| Google Business Profile | `business-lookup` edge fn (used in Setup step 2) | Add "Import from Google" action inside Concierge business section, deep-link to Setup step 2 for full flow |
| Website Import | `ai-prefill-setup` edge fn | Add inline action in business section |
| Business Hours | concierge `hours` section | Reuse |
| Service Areas | concierge `service_area` section | Reuse |
| Services | concierge `services` section | Reuse |
| FAQs | concierge `faqs` section | Reuse |
| AI Personality | `AiReceptionistTab` (tone, persona) | Add new concierge `personality` section that writes the same `tone`/persona fields |
| Voice Selection | `VoicePicker` component | Embed `VoicePicker` inside a new `voice` concierge section |
| Greeting | concierge `greeting` section | Reuse |
| Business Hours Routing | `PhoneSetupWizard` / call-handling fields | New `hours_routing` section editing `rings_before_answer`, after-hours mode |
| After-Hours Greeting | concierge `after_hours` section | Reuse |
| Call Forwarding | `forward_phone` field in `PhoneSetupWizard` | New `call_forwarding` section editing same field |
| Voicemail | `voicemail_enabled`, `voicemail_fallback` | New `voicemail` section |
| SMS Fallback | concierge `sms_followup` | Reuse |
| Calendar Connection | `IntegrationsTab` Google Calendar block | Deep-link button "Open Calendar Integration" → `/settings?tab=integrations#calendar` |
| Knowledge Base | `KnowledgeTab` (`knowledge_base` field) | New concierge `knowledge` section with same editor |
| Test Call | existing `TestCallButton` | Embed in new `test_call` concierge section; mark complete when `place-test-call` reports success |

No new standalone settings pages. Where a feature lives in an existing tab and is too heavy to inline (Calendar OAuth, full phone provisioning), the Concierge launches that tab via deep-link and listens for the underlying field to flip, then auto-marks the step complete.

## 3. Visual progress tracker

New component `src/onboarding/ProgressTracker.tsx`:
- Compact pill (header, all pages) showing `X / N complete` with overall %.
- Full panel (Concierge sidebar + Dashboard widget + new "Setup" panel at top of `/settings`) listing each item with its status icon and a `Resume` / `Open` button that jumps to the right Concierge section or settings deep-link.

Replace `SetupProgressBadge` / `SetupProgressBanner` content with this tracker (keep the components as thin wrappers so existing imports keep working).

## 4. Completion gate + Activate button

`src/onboarding/readiness.ts` exports `isReadyToActivate(state)` based on the required set above. Concierge `review` step's primary CTA becomes:

- Disabled while not ready, with a checklist of what's missing.
- When ready: `ACTIVATE MY AI RECEPTIONIST` — runs the existing apply flow + `update-vapi-agent` sync + sets `onboarding_state.activated_at` and `launched_at`.

## 5. Final readiness screen

After activation, replace `PostApply.tsx` content with a Go-Live readiness report: green check rows for each required item, optional rows (Calendar) shown as "Connected" or "Skipped", and a large `GO LIVE` button that navigates to `/dashboard` and fires `update-vapi-agent` one last time.

## Technical changes

- **Migration**: add `onboarding_state jsonb` to `callcapture_clients` (nullable, default `null`).
- **New files**:
  - `src/onboarding/status.ts` — derive + merge status, types, required set.
  - `src/onboarding/readiness.ts` — `isReadyToActivate`.
  - `src/onboarding/ProgressTracker.tsx` — pill + full panel.
  - `src/onboarding/useOnboardingState.ts` — load/save/merge hook.
  - Concierge sections: `personality.tsx`, `voice.tsx`, `hours_routing.tsx`, `call_forwarding.tsx`, `voicemail.tsx`, `knowledge.tsx`, `calendar.tsx`, `test_call.tsx` (each one a thin wrapper that mounts the existing component/editor and reports completion back to `useConcierge`).
- **Edits**:
  - `src/concierge/sections.ts` — extend `SectionId` and `SECTIONS` with the new sections (insert before `review`), keep existing ones.
  - `src/concierge/SectionRenderer.tsx` — route new IDs to the new wrappers.
  - `src/concierge/ReviewAndApply.tsx` — show readiness checklist, gate Activate button on `isReadyToActivate`.
  - `src/concierge/PostApply.tsx` — rewrite as readiness/Go-Live screen.
  - `src/concierge/useConcierge.ts` — on `apply`, also update `onboarding_state` items to `complete`; expose `markStatus(itemId, status)`.
  - `src/settings/ControlCenter.tsx` — add `ProgressTracker` panel at top; add `?tab=` + hash deep-link support so Concierge can jump to Integrations → Calendar, etc.
  - `src/pages/Dashboard.tsx` — add compact tracker widget when onboarding incomplete.
  - `src/components/SetupProgressBadge.tsx` — read from `onboarding_state` instead of `setup_step`.
  - `src/components/OnboardingGate.tsx` — treat `onboarding_state.activated_at` as the "complete" signal alongside legacy `launched_at` / `onboarding_completed_at`.

## Deliverable: Audit report (will be included in final response)

- **Existing modules reused**: BusinessTab, IndustryCombobox, business-lookup, ai-prefill-setup, AiReceptionistTab persona/tone, VoicePicker, KnowledgeTab, IntegrationsTab (Calendar), TestCallButton, PhoneSetupWizard call-handling fields, all current Concierge sections.
- **New modules required**: onboarding state hook + status deriver, ProgressTracker, 8 new Concierge section wrappers (personality, voice, hours_routing, call_forwarding, voicemail, knowledge, calendar, test_call), readiness gate, Go-Live screen, deep-link support in ControlCenter.
- **Duplicate settings pages to retire (later, not in this change)**: `/setup` 11-step wizard becomes redundant once Concierge covers everything — keep it for one release behind a feature flag, then remove. `AiSettingsPanel` is already superseded by the AI Control Center; mark for removal.
- **Remaining blockers before Founder Beta**: Google Calendar OAuth callback must reliably flip a `google_calendar_connected_at` field (needed so Concierge can auto-detect); phone provisioning must set `vapi_phone_number_id` synchronously (already does for Twilio path); test-call success must be recorded on the client row (add `test_call_passed_at`).

Two small additive schema fields requested in the same migration: `google_calendar_connected_at timestamptz`, `test_call_passed_at timestamptz`.
