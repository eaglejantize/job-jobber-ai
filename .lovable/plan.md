# Vektuor AI Control Center — Settings Redesign

Replace the current 11-step accordion Settings page with a tabbed AI Control Center that becomes the single source of truth for every receptionist. Subscribers configure everything in Vektuor; Vapi is mirrored automatically.

## Goals

- Replace `/settings` (currently `SetupAccordion`) with a `ControlCenter` shell using horizontal tabs.
- Make the tab framework extensible: each tab is a self-contained panel registered in one config array.
- Keep onboarding wizard (`/setup`) untouched — it stays the guided first-run flow. Settings is the power-user surface.
- Add a single "Sync to Vapi" action available from every tab (sticky header) plus an auto-sync on save.

## Information Architecture

```text
/settings
└── ControlCenter (tabs)
    ├── Business         → profile, grouped category, hours, service area, emergency, holidays
    ├── AI Receptionist  → greetings, voice, style, scheduling mode, fees, recording, live preview
    ├── Knowledge        → services, FAQs, policies, warranty, brands, area notes, KB, uploads (stub)
    ├── Integrations     → Vapi, Twilio, Google/MS calendars, Stripe, QBO, Jobber, HCP, ST, Zapier, webhooks
    ├── Industry Workflow (Preview)  → read-only preview of workflow schema; "coming soon"
    ├── Testing          → place test call, recent calls, transcripts, extracted intake, replay, prompt debug
    └── Analytics        → calls, answered/missed, appts, avg length, conversion, AI performance
```

## Tab 1 — Business

- Fields: name, owner, phone, email, address, website, time zone.
- **Grouped Business Category**: replace flat dropdown with a 2-level Combobox grouped by category group (Home Services, Automotive, Commercial Services, Industrial / Manufacturing, IT / Technical, Cleaning, Logistics, Pet, Personal, Specialty Trades, Other). Persist both `business_category_group` and `business_industry`.
- Business Hours editor (existing day-hours schema reused).
- Service Area: list of cities/zips + radius.
- Emergency Services toggle + after-hours rules.
- Holiday Hours: date overrides.

## Tab 2 — AI Receptionist

- Greeting + After-Hours Greeting (textarea with AI rewrite button — reuse `ai-rewrite-greeting`).
- Voice Selection (reuse `VoicePicker`), Language, Conversation Style/Tone, AI Personality.
- Transfer Number, Voicemail enabled, Call Recording, Call Summary, SMS Follow-up toggles.
- Scheduling block:
  - `scheduling_enabled`
  - `scheduling_mode` ∈ {intake_only, collect_preferred_time, book_from_calendar, transfer_to_office}
  - `diagnostic_fee` (numeric) + display rules
- Live Greeting Preview card (text + "Place Test Call" button reusing `TestCallButton`).

## Tab 3 — Knowledge

- Services Offered (chip list).
- FAQs (Q/A repeater — existing schema).
- Company Policies, Warranty, Brands Serviced, Service Area Notes (textareas).
- Knowledge Base: long-form markdown.
- File Uploads: UI stub + storage bucket placeholder; "Coming soon" badge, no functional upload yet.

## Tab 4 — Integrations

- Cards grid. Each card: logo, status badge (Connected / Not Connected / Coming Soon), connect/disconnect action.
- Live: Vapi (read-only status from existing assistant), Twilio (number + provisioning), Google Calendar (existing), Stripe (existing billing).
- Coming Soon (visible but disabled): Microsoft 365, Outlook, QuickBooks, Jobber, Housecall Pro, ServiceTitan, Zapier.
- Webhook Settings: list of outbound webhook URLs + secret reveal/regenerate.

## Tab 5 — Industry Workflow (Preview)

- Read-only preview panel describing the workflow schema fields: `required_fields`, `trade_questions`, `urgency_rules`, `scheduling_rules`, `service_fee_rules`, `intake_summary_format`.
- "Coming soon" state. No editor yet. Database columns prepared so future builds drop in without migration churn.

## Tab 6 — Testing

- Place Test Call (reuse `TestCallButton`).
- Recent Calls table (from `callcapture_calls`) with status, duration, caller.
- Row drawer: transcript (`callcapture_transcript_turns`), extracted intake (lead row), structured output JSON, audio replay (if `recording_url`), prompt-debug panel showing the exact system prompt sent for that call.

## Tab 7 — Analytics

- KPI cards: total / answered / missed calls, appts requested, appts booked, avg call length, conversion rate (booked / answered).
- AI Performance: tool-call success rate, extraction completeness, transfer rate.
- Customer Satisfaction: placeholder.

## Sync to Vapi

- Sticky header in `ControlCenter` shows last sync time + "Sync to Vapi" button.
- Auto-sync triggered on Save in any tab (debounced, toast on success/failure).
- Extend `update-vapi-agent` edge function to push the full mirrored payload: business name, industry, services, hours, service area, greeting, after-hours greeting, scheduling settings, service fee, knowledge base, FAQs, voice settings. Builds `systemPrompt` from all of the above so Vapi is purely the voice engine.
- Add `last_vapi_sync_at` and `last_vapi_sync_status` to `callcapture_clients`.

## Data Model Changes

Single migration adding columns to `callcapture_clients`:

- `business_category_group text`
- `business_email text`
- `service_area jsonb` (cities, zips, radius)
- `emergency_services boolean`, `emergency_rules jsonb`
- `holiday_hours jsonb`
- `language text default 'en-US'`
- `conversation_style text`
- `ai_personality text`
- `transfer_number text` (if missing)
- `voicemail_enabled boolean`, `call_recording_enabled boolean`, `call_summary_enabled boolean`, `sms_followup_enabled boolean`
- `scheduling_enabled boolean`, `scheduling_mode text`, `diagnostic_fee numeric`
- `company_policies text`, `warranty_terms text`, `brands_serviced text[]`, `service_area_notes text`, `knowledge_base text`
- `webhook_urls jsonb`, `webhook_secret text`
- `industry_workflow jsonb` (preview schema slot)
- `last_vapi_sync_at timestamptz`, `last_vapi_sync_status text`

New `src/lib/industries.ts` replacement: grouped industry catalog exporting `INDUSTRY_GROUPS` and helper `findIndustry(value)`.

## File Plan

```text
src/pages/Settings.tsx                          # render <ControlCenter />
src/settings/ControlCenter.tsx                  # tab shell, sticky header, sync action
src/settings/tabs/BusinessTab.tsx
src/settings/tabs/AiReceptionistTab.tsx
src/settings/tabs/KnowledgeTab.tsx
src/settings/tabs/IntegrationsTab.tsx
src/settings/tabs/IndustryWorkflowTab.tsx       # preview-only
src/settings/tabs/TestingTab.tsx
src/settings/tabs/AnalyticsTab.tsx
src/settings/tabs/registry.ts                   # [{ id, label, icon, component, requiresFlag? }]
src/settings/useControlCenterData.ts            # extends useSetupData with new fields
src/settings/IndustryCombobox.tsx               # grouped combobox
src/settings/SyncToVapiButton.tsx
src/lib/industries.ts                           # replaced with grouped catalog
supabase/functions/update-vapi-agent/index.ts   # extended payload + status writeback
supabase/functions/sync-vapi-full/index.ts      # optional dedicated full-sync entry
```

`SetupAccordion` and `/setup` wizard remain untouched.

## Rollout

1. Migration: add columns + grouped industry storage.
2. Replace `src/lib/industries.ts` with grouped catalog; build `IndustryCombobox`.
3. Build `ControlCenter` shell + tab registry; wire `/settings` to it.
4. Implement Business, AI Receptionist, Knowledge tabs first (covers Vapi sync surface).
5. Extend `update-vapi-agent` to mirror full payload + write `last_vapi_sync_*`.
6. Add Integrations tab (Vapi/Twilio/Calendar/Stripe live; others as "coming soon" cards).
7. Add Testing tab (call list + drawer).
8. Add Analytics tab (KPI queries from `callcapture_calls` / `callcapture_appointments`).
9. Add Industry Workflow preview tab.

## Out of Scope

- Workflow engine execution (only schema prep).
- Real integrations for QBO, Jobber, HCP, ServiceTitan, Zapier, MS365 (UI stubs only).
- Knowledge file uploads (UI stub only).
- Customer Satisfaction analytics.

## Open Questions

1. Should saving any tab auto-trigger Vapi sync, or only the explicit "Sync to Vapi" button?
2. For Industry Workflow, do you want the preview tab visible to all subscribers now, or hidden behind a super-admin flag until shipped?
3. Should the existing 11-step wizard at `/setup` keep using the old flat industry list, or also adopt the grouped catalog?
