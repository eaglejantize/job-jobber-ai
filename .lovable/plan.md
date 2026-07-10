# Vektuor Launch Stabilization — Phone & Voice Restoration (revised)

## Regression diagnosis (unchanged)

Recent Git churn left the codebase referencing a voice-catalog schema that was never created in the database. The previous fix silenced the TypeScript errors with blanket `as any` casts across ~15 files instead of restoring the schema. Concrete confirmations from the live DB:

- `callcapture_voice_catalog` table: **missing**.
- `callcapture_clients` columns **missing**: `selected_voice_catalog_id`, `voice_provider`, `voice_provider_voice_id`, `voice_provider_agent_id`.
- All phone-related columns **present and correct** (`business_phone`, `assigned_callcapture_number`, `phone_mode`, `forward_first`, `forward_phone`, `forwarding_from_number`, `transfer_number`, `rings_before_answer`, `twilio_phone_number_sid`, `vapi_assistant_id`, `vapi_phone_number_id`, `number_status`, `number_provisioned_at`, `webhook_status`, `webhook_urls`, `webhook_secret`).
- Vapi/Twilio secrets are set; no 401 evidence in logs. Do not touch secrets.

Because the catalog table doesn't exist, `loadCuratedVoices()` always falls back to the legacy placeholder list in `src/lib/voices.ts`, and `resolveVoiceForClient()` always falls back to `legacyVoice()` — which is why every selection collapses to Elliot/one fallback and why saves appear to "disappear."

## Approach

Restore, don't rebuild. Add the missing schema so the existing components work as designed, then curate exactly 12 **provider-verified** voices with no hardcoded assumptions.

### Part A — Schema restoration (single migration)

1. `CREATE TABLE public.callcapture_voice_catalog` with columns matching `VoiceCatalogOption` in `src/lib/voiceCatalog.ts` plus `accent`, `tone`, `pace`, `best_use`, timestamps.
2. `ALTER TABLE callcapture_clients` — add `selected_voice_catalog_id uuid NULL REFERENCES public.callcapture_voice_catalog(id) ON DELETE SET NULL` (referential integrity per correction #5), plus `voice_provider text`, `voice_provider_voice_id text`, `voice_provider_agent_id text`.
3. GRANTs + RLS:
   - Catalog reads: `GRANT SELECT ON public.callcapture_voice_catalog TO authenticated` (per correction #6 — no `anon`). Policy: `is_active = true` visible to `authenticated`.
   - Writes on catalog: `service_role` only (used by `admin-voice-catalog-sync`).
   - Tenant selection persistence stays on the existing `callcapture_clients` policies.
4. `updated_at` trigger via existing `public.set_updated_at()`.

The catalog is seeded in Part C **only after** the verification table passes.

### Part B — Restore phone setup with explicit lifecycle (correction #4)

No redesign of `PhoneNumberSection`, `PhoneNumberPicker`, `provision-twilio-number`, `provision-vapi-number`, `link-existing-number`, `repair-routing`, `search-twilio-numbers`. Fix only:

1. Introduce a derived phone lifecycle state used by the setup UI and onboarding readiness:
   - `not_started` — no `assigned_callcapture_number` and no `phone_mode`.
   - `configured` — tenant submitted a valid path (number chosen or existing linked) but Twilio/Vapi/webhook fields not all confirmed.
   - `pending_provisioning` — number present, `number_status='pending'` or `webhook_status` incomplete or `vapi_phone_number_id` missing.
   - `ready` — `assigned_callcapture_number` set AND `webhook_status='ok'` AND `vapi_phone_number_id` present AND `vapi_assistant_id` present.
   - `error` — `number_status='error'` or `last_vapi_sync_status` starts with `error:` or webhook failure recorded; surfaces the exact failed requirement with a retry/repair action (existing `repair-routing` invocation).
2. Update `src/onboarding/status.ts` so the phone checklist item:
   - allows **Save and Continue** at `configured` and `pending_provisioning`;
   - does **not** report `ready` or "active" until the `ready` predicate above holds;
   - shows a badge explaining what is pending;
   - never traps the user in a reload loop.
3. Label the two fields explicitly in `BusinessTab` and `PhoneNumberSection`:
   - **Business Phone Number** = `business_phone` (customer's existing public number).
   - **Vektuor AI Phone Number** = `assigned_callcapture_number` (read-only display + Replace).
   - Never write one into the other.
4. Remove the `as never` cast in `PhoneNumberSection` update payloads and the `row as any` cast in `useOnboardingState` after the migration lands.

Tenant scoping already enforced by existing `callcapture_clients` RLS — verified in validation step, not changed.

### Part C — 12 provider-verified agents (corrections #1, #2, #3, #7)

No voice IDs, names, or preview URLs will be hardcoded from historical documentation or the legacy `src/lib/voices.ts`. Instead:

1. **Prerequisite check.** Call `standard_connectors--list_connections` for `elevenlabs`. If not linked, link via `standard_connectors--connect`. Confirm Vapi has an ElevenLabs credential configured by attempting a test assistant update in a scratch assistant with `provider="11labs"` and reporting the exact provider error if it fails.
2. **Enumerate providers.**
   - ElevenLabs: `GET https://api.elevenlabs.io/v1/voices` with `xi-api-key = $ELEVENLABS_API_KEY`. Read each voice's `preview_url` field directly from this response (correction #2 — do **not** synthesize `/v1/voices/{id}` as a preview URL).
   - Vapi native: `GET https://api.vapi.ai/voice` with `Authorization: Bearer $VAPI_API_KEY`.
3. **Candidate scoring.** For each candidate voice, populate the verification table with the columns from correction #7:

   | display_name | provider | provider_voice_id | provider_lookup | preview_url | preview_playback | vapi_update | vapi_reread | verified_active |

   Checks performed per row:
   - `provider_lookup`: voice ID appears in the provider's live list response.
   - `preview_url`: non-null `preview_url` from the provider's own response.
   - `preview_playback`: HTTP HEAD/GET on `preview_url` returns 200 with an `audio/*` `Content-Type` and non-empty body.
   - `vapi_update`: PATCH a scratch Vapi assistant with `{ voice: { provider: catalog.provider, voiceId: catalog.provider_voice_id } }` returns 2xx (correction #3 — provider is read from the catalog row, never hardcoded).
   - `vapi_reread`: GET on the same assistant returns the same `provider` + `voiceId`.
   - `verified_active`: true only if **all** of the above pass.
4. **Insertion rule.** Insert only rows where `verified_active = true`. Target a balanced mix (warm/professional/energetic/calm female + male, plus neutral, upbeat, calm premium, clear high-energy). If fewer than 12 pass, do **not** invent or backfill — insert what passes, report the count and exact blocker per skipped role in the final report, and surface the shortfall to the user before publishing. Coverage rule: at least **1 Vapi-native** and **1 ElevenLabs** voice must pass the round trip (correction #3).
5. Descriptions, accents, tones, pace, best-use are written based on the provider metadata (`labels`, `category`, `description`) and my listening/verification pass. Nothing is asserted that isn't backed by the provider response or preview audio.

The verification table is produced and shown to the user for review **before** the seed insert.

### Part D — Selection & sync correctness (unchanged, plus mixed-provider guarantee)

Existing `VoicePicker`, `selectionFromOption`, `AiSettingsPanel`, `update-vapi-agent`, `verify-voice-sync`, `SyncToVapiButton` remain. Only the `as any` casts introduced by the previous compilation-only fix are removed in these voice/phone code paths.

Confirm `update-vapi-agent` uses `resolvedVoice.provider` and `resolvedVoice.providerVoiceId` from `voice-resolution.ts` for every request — no provider literal. Add a runtime assertion in `update-vapi-agent` that logs and returns an error if `resolvedVoice.provider` is missing.

### Part E — Cast cleanup (scoped)

Only the `as any` / `as never` / `as unknown` casts introduced in the previous compilation-only fix, and only where the migration makes them unnecessary: `AiSettingsPanel.tsx`, `IndustryConfigManager.tsx` (voice bits only), `voiceCatalog.ts`, `SectionRenderer.tsx` (voice/phone bits only), `useOnboardingState.ts`, `PhoneNumberSection.tsx`, `BusinessTab.tsx` (voice/phone fields only). Unrelated tabs (Analytics, Integrations, Knowledge, Testing) are not touched.

## Validation before reporting complete

Automated:

- `npm run build`, `npm run lint`, `npm run test`.
- `supabase--read_query` to confirm the new columns, the FK, the RLS policy set, and the inserted verified rows.

Provider round-trip:

- Verification table (correction #7) attached to the final report.
- Successful mixed-provider Vapi update+reread for at least one Vapi-native and one ElevenLabs voice (correction #3).

Manual tenant flow (as a normal, non-admin tenant via Playwright):

1. Setup opens; Business Phone entered and saved; Vektuor phone section accessible.
2. Number selected or existing linked; ring count + forwarding saved and persist after refresh.
3. Twelve verified agents (or the actual verified count) display; every preview matches its card.
4. Selecting a new agent deselects the previous; selection survives refresh and log out/in.
5. Saved `voice_provider_voice_id` matches the selected catalog row.
6. Sync to Vapi succeeds; `verify-voice-sync` confirms assistant `provider`+`voiceId` matches selection.
7. Test call (`place-test-call`) uses the selected voice.
8. Second tenant cannot see/change tenant A's row (RLS).
9. Complete Setup either succeeds (`ready`) or displays the exact pending requirement — never a blank reload loop.
10. Phone system is never labeled ready/active until all four confirmations exist (`assigned_callcapture_number`, `webhook_status='ok'`, `vapi_phone_number_id`, `vapi_assistant_id`).

## Files expected to change

- **New migration** (Part A).
- `src/lib/voiceCatalog.ts` — remove `as any`.
- `src/components/settings/AiSettingsPanel.tsx` — remove voice-scoped `as any`.
- `src/concierge/PhoneNumberSection.tsx` — remove `as never`; explicit label.
- `src/settings/tabs/BusinessTab.tsx` — explicit label; scoped cast cleanup.
- `src/onboarding/status.ts` — explicit phone lifecycle states + readiness rules (correction #4).
- `src/onboarding/useOnboardingState.ts` — drop `row as any`.
- `supabase/functions/update-vapi-agent/index.ts` — runtime assertion that `provider` is present; no hardcoded provider.
- `supabase/functions/_shared/voice-resolution.ts` — no logic change (works once catalog exists).

## Out of scope

Lead inbox, CRM, MCP, billing, marketing pages, audit/confirmation-token architecture, industry config, unrelated dashboard pages, general refactors, secrets rotation, concierge/setup redesign.

## Final report will include

Root cause per regression; files changed with reason; DB fields used; the verification table for all voice candidates (correction #7); provider voice IDs verified with mixed-provider Vapi round-trip evidence; build/lint/test results; manual tenant flow results; RLS cross-tenant check; any remaining blockers (including honest voice-count shortfall if the provider cannot supply 12 verified voices). Nothing is published — the report is delivered for review.
