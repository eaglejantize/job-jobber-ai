
# Vektuor Live Ops Dashboard

Rebuild `/dashboard` as a real-time, 3-column operational console — fully functional, backed by Lovable Cloud data and a Vapi webhook for live calls.

## 1. Database changes (single migration)

New tables (all RLS-scoped to the owning client, `service_role` full access for the webhook):

- `callcapture_calls` — one row per call
  - `client_id`, `business_id`, `lead_id` (nullable)
  - `caller_name`, `caller_phone`, `issue_summary`
  - `status` enum: `live | new | booked | transferred | completed | missed`
  - `started_at`, `ended_at`, `duration_seconds`
  - `vapi_call_id` (unique), `recording_url`
- `callcapture_transcript_turns`
  - `call_id`, `role` (`ai | caller`), `text`, `at` timestamp, `seq`
- `callcapture_technicians`
  - `client_id`, `name`, `phone`, `status` (`available | assigned | en_route | off`)
- `callcapture_dispatch`
  - `call_id` (unique), `technician_id`, `status` (`assigned | en_route | arrived | cancelled`), `eta_minutes`
- `callcapture_sms_messages`
  - `call_id`, `lead_id`, `to_phone`, `body`, `direction` (`outbound | inbound`), `sent_at`, `status`

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE` for all five tables.

GRANTs: `authenticated` (SELECT/INSERT/UPDATE/DELETE) + `service_role` ALL on each.

## 2. Vapi webhook (`supabase/functions/vapi-webhook/`)

New edge function, `verify_jwt = false`, validated with `VAPI_WEBHOOK_SECRET` (already in secrets). Handles Vapi event types:
- `call-start` → insert `callcapture_calls` row with `status='live'`
- `transcript` / `conversation-update` → append rows into `callcapture_transcript_turns`
- `tool-calls` (intake completion) → upsert `callcapture_leads` + link `lead_id` on call, set status `new`
- `transfer-destination-request` → status `transferred`
- `end-of-call-report` → set `ended_at`, `duration_seconds`, `recording_url`, `status='completed'` (or `booked` if intake captured), generate dispatch row if technician available

(Existing `update-vapi-agent` flow remains untouched.)

## 3. Manual SMS edge function (`supabase/functions/send-followup-sms/`)

Validates auth + ownership of the call, sends via existing Twilio credentials, inserts a `callcapture_sms_messages` row.

## 4. Frontend — new `src/pages/Dashboard.tsx`

Replaces existing dashboard. Old setup/status/quick-action cards move to `/settings` (new "Account status" section). Layout:

```text
┌──────────────────────────── Header ─────────────────────────────┐
│ ● Live   Calls today: 14   Leads: 9   Active: 2   [Vektuor]     │
├──────────┬──────────────────────────────┬───────────────────────┤
│ INBOX    │ ACTIVE CALL                  │ INTAKE                │
│ list of  │ caller + status + timer      │ Name / Address /      │
│ calls    │ waveform (if live)           │ Issue / Urgency       │
│ Live dot │ transcript bubbles           │ ─ DISPATCH ─          │
│ + pulse  │  AI ◀                        │ tech, ETA, status     │
│          │           ▶ Caller           │ ─ SMS FOLLOW-UP ─     │
│          │                              │ last msg + Send btn   │
└──────────┴──────────────────────────────┴───────────────────────┘
        ↘ toast bottom-left: "New lead captured · Synced to CRM"
```

Components (new, under `src/components/dashboard/`):
- `DashboardHeader.tsx` — system status dot, counters
- `CallInbox.tsx` — left column list, click selects, Live items pulse
- `ActiveCallPanel.tsx` — center: header, duration timer, waveform (`CallWaveform.tsx` — CSS bar animation when live), transcript bubbles
- `IntakePanel.tsx` — right: intake fields, dispatch card, SMS card with send button
- `NewLeadToast.tsx` — sonner toast triggered on realtime insert

Data hooks (`src/hooks/`):
- `useCalls(clientId)` — initial fetch + realtime channel on `callcapture_calls`
- `useCallDetail(callId)` — fetch + realtime on transcript turns, dispatch, sms
- `useDashboardStats(clientId)` — today counts (calls, leads, active)

State: selected call id in URL (`?call=...`) so it survives refresh. If no live call, auto-select most recent completed.

Mobile: stack columns vertically; inbox collapses to a horizontal scroller; intake becomes a bottom drawer triggered from the call panel.

## 5. Vektuor rebrand

- Add fonts via `@fontsource/space-grotesk` (display) + `@fontsource/inter` (body); import in `src/main.tsx`; wire into `tailwind.config.ts`.
- `src/index.css` tokens (dark default):
  - `--background: 222 47% 4%` (near-black navy), `--card: 222 40% 7%`, `--border: 222 30% 14%`
  - `--foreground: 210 20% 96%`, `--muted-foreground: 215 16% 65%`
  - `--primary: 152 84% 52%` (neon mint accent), `--primary-foreground: 222 47% 6%`
  - `--accent: 270 90% 65%` (electric violet, used sparingly on Live pulse + active states)
  - `--gradient-hero: linear-gradient(135deg, hsl(222 47% 4%), hsl(222 40% 8%))`
  - `--shadow-glow: 0 0 0 1px hsl(var(--primary)/0.25), 0 12px 40px -12px hsl(var(--primary)/0.45)`
- Update `Layout` + `AppNav` to use the new Vektuor wordmark (text mark in Space Grotesk) and dark surfaces; keep public landing untouched aside from token-driven colors.
- Replace product name "CallCapture" → "Vektuor" in nav, footer, page titles, document title.

## 6. Verification

- Migration applies cleanly; `supabase--linter` passes.
- Vapi webhook deployed; `curl_edge_functions` smoke test with a sample `end-of-call-report` payload inserts call + lead.
- Dashboard loads with seeded recent calls (insert a few demo rows via `supabase--insert` for the signed-in user).
- Selecting a call updates center + right columns; realtime insert of a transcript turn appears without refresh.
- Manual SMS button posts to `send-followup-sms` and the new message appears in the SMS card.
- Mobile (375px) viewport: columns stack, drawer works.

## Out of scope

- Twilio number provisioning, billing, onboarding wizard — unchanged.
- Lead inbox page (`/leads`) — unchanged.
- Outbound SMS templating / automation rules — single manual send only.
