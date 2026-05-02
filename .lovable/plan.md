# Restructure Setup Wizard into 6 Clear Steps

## Goal
Reorganize `src/pages/Setup.tsx` into the exact 6-step structure requested, with a clear progress indicator, consistent Continue/Back navigation, and resumable progress — without breaking existing data persistence (Supabase saves to `callcapture_businesses` and `callcapture_assistant_configs`) or any downstream Vapi/Twilio/dashboard flows.

## New Step Order
1. **Business Info** — name, industry, phone, email, service area, hours
2. **Phone Setup** — business phone (forwarded line) + alert/owner SMS number + a short "we'll provision your CallCapture number" explainer
3. **Call Handling** — call goals (Capture leads / Existing customers / Info calls), existing customer forwarding toggle + forward number, after-hours toggle, fallback action
4. **AI Receptionist Setup** — info to collect (intake questions, with custom add), transfer triggers
5. **Voice & Greeting** — receptionist name, tone (Friendly / Direct / Helpful), greeting line
6. **Review & Launch** — generated prompt preview + "Generate My AI Receptionist" CTA (saves to DB, marks client `setup_status = 'Live'`, navigates to `/dashboard`)

All fields currently in the wizard are preserved — just regrouped to match these step titles.

## UI Changes (per page)
- Sticky header inside the wizard hero showing:
  - `Step X of 6 — {Step Title}`
  - Horizontal `<Progress />` bar (already imported)
- Card body shows the step title (h2) + description
- Footer of card always shows:
  - **Back** button (ghost, disabled on Step 1)
  - **Continue** button (Step 1–5) OR **Generate My AI Receptionist** (Step 6)
- Per-step validation kept (e.g. Step 1 requires business name + industry; Step 3 requires at least one call goal)

## Resumable Progress
- Wizard form state already persists to `localStorage` via `saveWizardState` / `loadWizardState` (`callcapture.wizard` key).
- Add a second key `callcapture.wizard.step` storing the current step index (0–5). Restore on mount; clear on successful "Generate" along with existing wizard state via `clearWizardState`.
- Existing prefill from `callcapture_clients` (by `user_id`) is kept untouched so signed-in users still see their info on return.

## Technical Notes
- Single file edited: `src/pages/Setup.tsx`.
- Keep existing helpers (`Field`, `SelectField`, `ToggleRow`, `CheckRow`) and reuse them.
- Keep existing `generateAndFinish()` function and its Supabase inserts/updates exactly as-is — only the step that triggers it moves to Step 6.
- `STEPS` array updated to the new 6 titles.
- Add `localStorage` read/write for `callcapture.wizard.step` in a `useEffect` mirroring the existing pattern.
- No route changes, no schema changes, no edge function changes.

## Out of Scope
- No changes to auth, Stripe checkout, webhook, dashboard, Vapi/Twilio, or lead capture.
- No new DB columns (existing tables already store all wizard data).
