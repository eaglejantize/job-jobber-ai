# Home Dashboard Cleanup & Accuracy

Goal: Make `src/pages/Home.tsx` a faithful read-only view of the tenant's saved configuration in `callcapture_clients`, and remove legacy/duplicate UI. All values shown fall back to "Not configured" instead of hardcoded defaults.

## 1. Fix data source for Home

Today Home reads voice + rings from `callcapture_assistant_configs.notification_settings/call_rules`, which the concierge wizard never writes to. Switch Home to read from the tenant row in `callcapture_clients` (the concierge's source of truth):

- `voice_id`, `voice_label`, `ai_personality` → AI Voice card
- `business_phone` → Business Number card
- `assigned_callcapture_number`, `number_status` → Vektuor Number card
- `rings_before_answer` → Rings Before AI card
- `greeting`, `business_hours_schedule`, `forward_phone`, `google_calendar_id`, `concierge_state`/`activated_at` → future cards & completion state

If a field is null/empty, render "Not configured" (with a link to the relevant wizard step where useful) — never a hardcoded default like "Maya" or "3 rings".

## 2. AI Voice card (issue #1, #8)

- Resolve label via `getVoiceByLabel(client.voice_label) ?? getVoiceById(client.voice_id)`.
- Show `{label} · {persona}` from that record. If none saved → "Not configured" + link to AI Receptionist step.
- Delete the `?? "Maya"` fallback and the read from `assistant_configs.notification_settings.voice`.

## 3. Business Phone vs Vektuor Number (issue #2)

Replace the current "Business Phone" status tile + duplicate "Phone Number" in Call Setup with two clearly-labeled fields sourced independently:

- **Vektuor Number** = `assigned_callcapture_number` + `number_status` badge (unchanged logic, keep polling for provisioning states).
- **Business Number** = `business_phone` from `callcapture_clients` only. Never fall back to the Vektuor number or `alert_phone`. If missing: show "Not configured" + a "Configure Business Number" button linking to `/settings/concierge` at the business_profile step.

Remove the top-row "Business Phone" tile (or repurpose it as "Business Number") so the number is displayed exactly once.

## 4. Rings Before AI (issue #3)

The wizard already lists `rings_before_answer` in the Hours section fields, but there is no UI for it and Home reads a different key. Fix both ends:

- **Wizard**: in `src/concierge/SectionRenderer.tsx`, add a Rings-Before-AI control to the AI Receptionist step (move `rings_before_answer` out of `hours` and into `ai_receptionist` in `sections.ts` so it lives with related settings). Options: `0` (Answer immediately), `1`, `2`, `3`, `4`, `5`. Include short helper copy: "How many rings should occur before the AI answers?" Persist via `setField("rings_before_answer", n)`.
- **Home**: read `client.rings_before_answer`. Display `"Answer immediately"` for `0`, `"{n} ring[s]"` otherwise, `"Not configured"` if null. Add a small "Edit" link that navigates to `/settings/concierge?step=ai_receptionist` (or the section id used by ConciergePage).

## 5. AI Backup card (issue #4)

Since there's no configurable backing field yet, **hide the card entirely**. Remove `aiAnswerMissed` state and the "AI Backup" tile from Home. (We can reintroduce it under a clearer name — "Missed Call Protection" — once it is actually wired to a persisted field.)

## 6. Remove "Want us to set this up for you?" (issue #5)

- Delete `<RequestSetupBanner />` usages in `src/pages/Home.tsx`, `src/pages/Demo.tsx`, `src/pages/Pricing.tsx`.
- Delete the component file `src/components/RequestSetupBanner.tsx`.

## 7. De-duplicate actions (issue #6, #7)

Simplify the Quick Actions row to exactly three buttons:

- **Test My AI** (`CallDemoButton`, primary)
- **Edit Setup** → `/settings/concierge` (replaces both "Edit Settings" and the always-visible "Continue setup"). While onboarding is incomplete (`!client.activated_at`), the label becomes **Continue Setup**; once activated, it becomes **Edit Setup**.
- **View Inbox** → `/leads`

Remove the standalone "Update Agent" button and the extra "Edit Phone Setup" button in the Call Setup card header (users can edit via the single Setup button).

## 8. Verification

- Load Home as a fresh tenant with only business_profile completed → all AI/phone tiles show "Not configured" or wizard link, no "Maya", no "3 rings".
- Complete concierge with voice=Anthony, rings=2 → Home shows "Anthony · <persona>" and "2 rings".
- Set business_phone different from Vektuor number → tiles show two different numbers.
- Confirm no `RequestSetupBanner` remains via `rg RequestSetupBanner`.

## Files touched

- `src/pages/Home.tsx` — rewire data source, restructure tiles, simplify actions, drop AI Backup, drop banner.
- `src/concierge/sections.ts` — move `rings_before_answer` into `ai_receptionist` fields.
- `src/concierge/SectionRenderer.tsx` — add Rings-Before-AI control in AI Receptionist step.
- `src/pages/Demo.tsx`, `src/pages/Pricing.tsx` — remove banner import/usage.
- Delete `src/components/RequestSetupBanner.tsx`.

No database migrations required — `rings_before_answer` already exists on `callcapture_clients` and the wizard already persists it.
