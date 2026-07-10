## Seed 11 verified Vapi voices, fix selection, disable fake preview

Current state:
- `callcapture_voice_catalog` is empty. Schema has `label`, `persona`, `provider`, `provider_voice_id`, `verified_active`, `is_active`, `sort_order`, `description`, `accent/tone/pace/best_use`, `provider_preview_url`, `local_preview_url`, `preview_source`. Unique key: `(provider, provider_voice_id)`. There is no `provider_verified` / `preview_verified` column yet.
- `VoicePicker.tsx` already loads from the catalog (falls back to legacy Elliot rows when empty — the root cause of "silent fallback to Elliot").
- `vapi-voice-sample` edge function currently synthesizes audio via **OpenAI TTS**, not Vapi voices — that is exactly the "fake preview" behavior the user forbids.
- Save/persist path in `AiReceptionistTab.tsx` already writes all 5 required fields.

### 1. Migration — add verification columns + seed 11 rows (idempotent)

Single migration that:
- Adds `provider_verified boolean not null default false` and `preview_verified boolean not null default false` (keeps existing `verified_active` untouched but stops implying audio verification).
- Removes the legacy fallback path so seeded rows are the only source of truth (code change, not SQL).
- `INSERT ... ON CONFLICT (provider, provider_voice_id) DO UPDATE` for exactly these 11 rows, all with:
  - `provider='vapi'`
  - `provider_voice_id` = Emma, Nico, Sagar, Kai, Neil, Clara, Godfrey, Layla, Sid, Naina, Elliot
  - `label` = same as ID
  - `persona = 'Vapi native voice'`
  - `customer_category = 'general'`
  - `description = 'Verified Vapi voice — preview to evaluate tone and fit.'`
  - `accent/tone/pace/best_use = NULL` (not inferred)
  - `provider_verified = true`, `preview_verified = false`, `verified_active = true` (means provider-API verified, per confirmed semantics)
  - `is_active = true`
  - `preview_source = 'provider'`, `provider_preview_url = NULL`, `local_preview_url = NULL`
  - `sort_order` 10, 20, …, 110 in the listed order

Safe to re-run — `ON CONFLICT` updates label/description/flags without duplicating.

### 2. Frontend changes (only voice picker + catalog loader)

`src/lib/voiceCatalog.ts`
- Drop `toLegacyFallback()` entirely. If the catalog query returns 0 rows or errors, return `{ voices: [], source: 'catalog', error }` so the UI can show an honest empty/error state — never silently substitute Elliot.
- Extend the `VoiceCatalogOption` type with `provider_verified` and `preview_verified`; include them in the select.

`src/components/VoicePicker.tsx`
- Render an empty/error state when no voices load ("Voice catalog is empty — contact support.") instead of falling back.
- Single-select semantics already correct (unchanged). Verify preview never triggers `onChange`.
- Replace the `<audio>` element with a disabled "Preview coming soon" button plus tooltip: *"Preview playback is not yet wired to Vapi. Voices are provider-verified but not audibly reviewed."* This satisfies the "do not fake preview" rule for this pass.
- Remove the `Verified` badge or relabel it to `Provider-verified` so we don't imply audio verification.

`src/settings/tabs/AiReceptionistTab.tsx`
- Ensure the saved-selection display uses `data.voice_label` (from catalog row) rather than the legacy `VOICES` array lookup that resolves to Elliot. Small tweak only.

No changes to phone provisioning, tenant assistants, sync logic, or Vapi API keys.

### 3. Preview (deferred safely)

Do NOT modify `vapi-voice-sample` this pass — leave the OpenAI-TTS synthesis in place but stop calling it from the picker. A follow-up will implement a real Vapi web-call preview (or Vapi TTS endpoint if available) against a scratch assistant. Until then, the preview control is honestly disabled.

### 4. Manual audio review UI (deferred)

Out of scope for this pass — the user's step 6 explicitly says "after preview works." Not building it now. Descriptions stay neutral and editable only via SQL/migration until reviewed.

### 5. Verifier cleanup

Remove `<VoiceVerificationRunner />` from `src/pages/Admin.tsx` and delete `src/components/admin/VoiceVerificationRunner.tsx`. Keep the `verify-voice-catalog` edge function in place for now and flag it in the final report as "retain as protected admin diagnostic OR remove — awaiting user call."

### 6. Validation

- `npm run build`
- `npm run test`
- `psql` query showing 11 rows with correct provider/provider_voice_id/flags
- Manual tenant flow described (select Emma → save → refresh → shows Emma; select Clara → save → refresh → shows Clara; sync still targets `vapi` + selected `provider_voice_id`)

### 7. Files changed

- new migration
- `src/lib/voiceCatalog.ts` (remove fallback, add columns)
- `src/components/VoicePicker.tsx` (disable preview, empty state, badge wording)
- `src/settings/tabs/AiReceptionistTab.tsx` (fix label lookup)
- `src/pages/Admin.tsx` (remove runner)
- delete `src/components/admin/VoiceVerificationRunner.tsx`

### 8. Explicitly not doing

Publish, phone changes, ElevenLabs, CRM/billing/MCP/inbox/marketing edits, audio-review admin UI, real Vapi preview, seeding a 12th placeholder, inventing accents/gender/tone descriptors.
