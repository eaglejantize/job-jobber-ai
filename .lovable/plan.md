## Plan: App-Wide Enhancement Pass (confirmed)

Brand: **Vektuor** (UI only; DB keeps `callcapture_` prefix). VAPI live fetch with fallback. SMS fires from the Vapi post-call webhook that writes the lead.

---

### 1. Database migration

`callcapture_clients` — add: `business_hours_24_7 bool default true`, `business_hours_schedule jsonb`, `timezone text default 'America/New_York'`, `rings_before_answer int default 3`, `forward_first bool default false`, `forward_phone text`, `answer_after_hours bool default true`, `transfer_fallback text default 'Take a message'`, `transfer_triggers text[] default '{}'`, `greeting text`, `include_business_name bool default true`, `human_pause bool default true`, `voice_id text`, `voice_label text`, `intake_questions jsonb`, `tone text default 'Friendly'`.

`callcapture_leads` — add: `client_id uuid references callcapture_clients(id) on delete cascade`, `status text default 'New'`, `transcript text`, `intake_answers jsonb`. Index `(client_id, created_at desc)`. RLS: owners select/update where `client_id` belongs to `auth.uid()`; admins via `is_current_user_super_admin()`; service_role full. Enable Realtime via publication add.

---

### 2. Industries (`src/lib/industries.ts`)

Replace with full 24-entry list per spec (excluding HIPAA-risk). Remove the duplicate `INDUSTRIES` array in `src/lib/constants.ts` and re-export from `industries.ts` to keep `/start`, Admin Create Test Account, and AI Settings in sync.

---

### 3. Phone Setup Wizard

New `src/components/settings/PhoneSetupWizard.tsx` replacing the Phone tab in `Settings.tsx`. Four steps with progress bar:
1. Number — radio (new / existing / test) + conditional existing-number input + optional area code.
2. Hours — 24/7 toggle; weekly grid (Mon–Fri group with "Apply to weekdays", Sat, Sun), 30-min increments 6 AM–10 PM + Midnight, US timezone dropdown.
3. Call Handling — rings 1–5, forward-first toggle + phone, after-hours toggle, fallback dropdown, transfer-trigger checkboxes.
4. Review & Activate — summary card + "Save & Activate" → upsert all fields, set `setup_status='Active'`, `payment_status='active'`, redirect `/dashboard`.

Remove duplicated settings across other tabs; consolidate to Phone / AI / Account.

---

### 4. AI Settings rebuild

New `src/components/settings/AiSettingsPanel.tsx`.

- **Greeting**: textarea + "Help me write this" → new edge function `generate-greeting` (Lovable AI Gateway, `google/gemini-3-flash-preview`) returning 3 clickable options. Toggles: include-business-name, human-pause.
- **Voice**: new edge function `list-vapi-voices` calling `GET https://api.vapi.ai/voice` with `VAPI_API_KEY`. Cards show name/provider/description + Preview button using `previewUrl`. Selected → emerald border, saved to `callcapture_clients.voice_id/voice_label`. On fetch failure → 6-voice fallback (Jasmine, Marcus, Claire, Nova, James, Luna) with ElevenLabs sample URLs.
- **Intake questions**: `src/lib/intakeQuestions.ts` — universal (always pre-checked) + per-industry additions per spec. Industry from `callcapture_clients.industry`. Checkbox list + "+ Add custom question". Persists to `intake_questions jsonb`.
- **Tone**: pills (Friendly/Professional/Direct/Cheerful/Calm) feeding prompt builder.

---

### 5. Dashboard

`Dashboard.tsx`: query current user's `callcapture_clients` row; render real `setup_status`. Quick Actions branch on status (Active → Test/Edit; Payment Pending → Complete Payment; else → Continue Setup → `/settings`). Realtime subscription on `callcapture_leads` filtered by `client_id` shows toast + live count bump.

---

### 6. Lead Inbox

`LeadInbox.tsx`: query `callcapture_leads WHERE client_id = <my client id> ORDER BY created_at DESC`. Card per lead — name or "Unknown Caller", phone, industry-aware summary from `intake_answers`, timestamp, status badge (New/Contacted/Closed). Expand → transcript + full intake. "Mark as contacted" updates status. Empty state per spec.

---

### 7. Admin — View Leads slide-over

`Admin.tsx` Subscribers table: per-row "View Leads" opens shadcn `Sheet` listing that client's leads (reuses lead card). Admin RLS already covers it.

---

### 8. SMS notification

New `supabase/functions/send-sms/index.ts` (Twilio gateway, body `{client_id, lead_id}`, looks up `alert_phone`, sends formatted SMS).

The existing Vapi post-call webhook (the one that inserts into `callcapture_leads`) — we'll locate or scaffold it and invoke `send-sms` right after the insert. No pg_net dependency. Dashboard toast continues to come from Realtime, not SMS.

---

### 9. Branding pass

Find/replace user-visible "CallCapture" → "Vektuor" across components, pages, meta tags, footer, nav. Leave DB names, function names, and the `callcapture_` table prefix alone.

---

### Out of scope

`/start` signup, `create-checkout`, `stripe-webhook`, admin auth guard, existing Twilio search/provision functions (wizard calls them with their current contracts).
