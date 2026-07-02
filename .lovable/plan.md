# Unify Onboarding & Settings into One Guided Wizard

## Goal
Collapse the two overlapping surfaces (`/setup`, `/settings`, `/settings/concierge`, `/onboarding`) into a single wizard that:
- Serves as first-run onboarding.
- Serves as the ongoing "settings" editor once complete.
- Has one accurate progress model, one navigation, no internal jargon, and no auto-scroll.

## 1. One setup flow (single source of truth)
- Promote the Concierge wizard (`src/concierge/ConciergePage.tsx`) to the canonical setup UI.
- `/settings` renders the same wizard component (not the tabbed `ControlCenter`). All previously-saved values load into the same fields.
- `/setup`, `/onboarding`, `/settings/concierge` all redirect to `/settings`.
- `OnboardingGate` no longer redirects to `/settings/concierge`; it just lets `/settings` render (the wizard IS the onboarding).
- Retire `src/pages/Setup.tsx`, `src/pages/Onboarding.tsx`, `src/pages/Concierge.tsx`, and `ControlCenter` + `src/settings/tabs/*` from the routed surface (files kept but unreferenced, or deleted in a follow-up).

## 2. Remove the progress summary card from Business Profile
- Remove `ProgressPanel` from the Business Profile section (and any per-section rendering).
- Remove `SetupProgressPill` / `SetupProgressBanner` / "Continue Setup" button from Business Profile.
- Keep a single slim progress bar in the wizard header (already exists as `<Progress value={pct}/>`).

## 3. Wizard buttons
Replace the current Back / Skip / Next footer with a consistent footer on every step:
- **Back** (unchanged)
- **Skip** — marks step skipped and advances (kept, needed for Integrations & optional items).
- **Save & Continue Later** — persists pending changes, exits to `/dashboard` (or `/` if unauth). Resumes on the exact step via `onboarding_state.step`.
- **Apply Changes** — persists pending changes for the current step, stays on the page, shows a "Saved" toast. Does not advance.
- **Next** — persists + advances (existing behavior).

Wire through `useConcierge.persist()` which already supports partial saves.

## 4. Remove duplicate navigation
- Delete the tabbed nav (Business / AI Receptionist / Knowledge / Integrations / Industry Workflow / Testing / Analytics) from the settings surface — it disappears when `ControlCenter` is unmounted (step 1).
- Left-hand step list inside the wizard stays (it's the wizard's own progress nav).

## 5. Integrations become a wizard step
- Add a new `SectionId: "integrations"` to `src/concierge/sections.ts`, placed between `calendar` and `test_call`.
- New renderer in `SectionRenderer.tsx` reusing the existing `IntegrationsTab` connect flows (Google Calendar, Twilio, ServanaHQ, etc.) inline.
- Mark the step complete if any integration connects OR the user clicks Skip; skipped counts as complete for progress + activation.
- Add `integrations` to `ITEM_ORDER` in `src/onboarding/status.ts` with `derived` logic: complete if `google_calendar_connected_at` OR any provider flag set.

## 6. Remove internal messaging
- Delete "Vektuor is the single source of truth for your AI receptionist." tagline.
- Remove the "Launch AI Setup Concierge" promo card (concierge IS the page now).
- Audit `ControlCenter`, `ConciergePage`, and setup steps for similar internal phrasing and replace with customer-facing copy ("Set up your AI receptionist").

## 7. Fix auto-scroll
- Remove `window.scrollTo({ top: 0, behavior: "smooth" })` calls in `ConciergePage.next()` / `prev()`.
- Do not scroll on autosave, validation errors, or state updates.
- Only scroll when the user explicitly clicks a step in the left nav (optional, opt-in), and use `scrollIntoView({ block: "nearest" })` scoped to the panel, not the window.

## 8. Progress tracking realignment
Rewrite `ITEM_ORDER` + `REQUIRED_FOR_ACTIVATION` in `src/onboarding/status.ts` to match the canonical wizard steps only:
1. Business Profile
2. Services
3. Business Hours
4. Google Business Profile
5. Website Import
6. Knowledge Base
7. AI Receptionist (personality + voice + greeting collapsed into one derived item)
8. Integrations (complete or skipped)
9. Test Call
10. Review & Activate

Progress % = `(complete + skipped) / total`. Required-for-activation trims to Business Profile, Services, Hours, AI Receptionist, Test Call.

Prune sub-sections in `SECTIONS` that don't map to the 10 steps (fold hours_routing, call_forwarding, voicemail, sms_followup, after_hours under the "AI Receptionist" step as sub-fields; fold faqs + policies into Knowledge Base).

## Technical notes
- Files touched: `src/App.tsx` (route consolidation + redirects), `src/pages/Settings.tsx` (render `ConciergePage`), `src/components/OnboardingGate.tsx` (no redirect), `src/concierge/ConciergePage.tsx` (footer buttons, no scroll, remove promo), `src/concierge/sections.ts` (10 canonical steps), `src/concierge/SectionRenderer.tsx` (new Integrations renderer, folded sub-fields), `src/onboarding/status.ts` (new ITEM_ORDER + required list), `src/onboarding/ProgressTracker.tsx` (drop from Business Profile), `src/settings/ControlCenter.tsx` (delete promo + tagline; component unrouted).
- No DB migration needed — `onboarding_state` already stores `items` + `step` as JSON, tolerant of new ids.
- `AppNav` "Settings" link continues to point at `/settings`; no user-facing URL changes.

## Out of scope
- No backend/webhook/edge function changes.
- No visual redesign of individual step content beyond what's needed to fold sub-sections.
