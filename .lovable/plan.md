# Vektuor MVP — Status Report

Scope check against the 7 MVP objectives, plus Google Calendar dual mode.

## 1. Confirmed working end-to-end

- **AI receptionist answers calls.** Per-tenant Vapi assistants are provisioned in `provision-twilio-number` with a Twilio number attached. Inbound calls hit `vapi-webhook`.
- **Tenant-scoped call ingestion.** `vapi-webhook` resolves the tenant by 4-tier lookup (metadata → vapi_phone_number_id → assigned number → assistant id), writes `callcapture_calls`, transcript turns, and a `callcapture_leads` row. Verified by recent test calls.
- **Lead extraction from transcript.** Lovable AI Gateway (Gemini) fallback fills name/phone/address/service/timing when Vapi `structuredData` is empty.
- **Owner SMS notification.** `send-sms` via Twilio connector, triggered from the webhook after lead insert. Fixed and working.
- **Inbox loads leads in real time.** `LeadInbox` + Dashboard query `callcapture_leads`/`callcapture_calls` directly with Supabase realtime. Diagnostics panel surfaces every webhook step.
- **Onboarding + provisioning.** 8-step setup wizard, Google Places business lookup, Twilio number search/purchase, tenant signup via service-role function, super-admin Admin panel with delete + billing bypass.
- **ServanaHQ sync (optional).** `sync-servanahq` POSTs into ServanaHQ's existing `intake-vapi` queue when secrets are set; webhook fires it fire-and-forget.

## 2. Built but not tested / partially working

- **Lead field completeness.** Address and urgency depend on the AI extractor; reliability depends on the system prompt. Not measured.
- **Per-tenant Vapi assistant tools.** `submit-intake` edge function exists as a Vapi tool, but the tool isn't wired into newly provisioned assistants by default — extraction is currently transcript-based.
- **Owner SMS body.** Sends a summary, but tenant `alert_phone` must be set in setup; not validated for every tenant path.
- **ServanaHQ multi-tenant routing.** Requires a paired edit in the ServanaHQ project (`x-vektuor-key` + `tenant_id` override) before non-default tenants land correctly. Not yet applied on that side.

## 3. Not built yet (MVP gaps)

- **Google Calendar — availability check.** No calendar code anywhere in the repo. Objective #3 is 0%.
- **Google Calendar — booking the job.** No event-create flow. Objective #4 is 0%.
- **Per-tenant Google OAuth.** No OAuth flow, no token storage table, no refresh logic. The Lovable `google_calendar` connector only authenticates the workspace owner's calendar — usable for the single-calendar test mode, but not for production multi-tenant.
- **Customer SMS confirmation.** `send-sms` only notifies the owner. No outbound SMS to the captured caller phone.
- **Customer email confirmation.** No email infrastructure exists (no Lovable Emails setup, no Resend, no templates).
- **Owner email notification.** Same — no email pipeline.
- **Booking/appointment data model.** No `appointments` or `bookings` table; `callcapture_leads` has no `scheduled_at`/`calendar_event_id` columns.

## 4. Recommended next build priority (fastest path to full MVP)

Sequence is chosen so each step is independently demoable.

1. **Schema: appointments + calendar linkage.**
   - Add `callcapture_appointments` (id, client_id, lead_id, start_at, end_at, status, calendar_provider, calendar_event_id, customer_name, customer_phone, customer_email, notes).
   - Add `google_calendar_id`, `google_oauth_*` fields to `callcapture_clients` for production mode.
   - Add `callcapture_google_tokens` (client_id, access_token, refresh_token, expires_at, scope) for per-tenant OAuth.

2. **Google Calendar — single-account test mode (fastest).**
   - Link the `google_calendar` workspace connector.
   - New edge function `calendar-find-slots` (freebusy on primary calendar) and `calendar-book-slot` (events.insert with attendee email/phone in description).
   - Wire both into the Vapi assistant as tools so the AI can offer real times and book during the call. Falls back to "we'll call you back" if the connector is missing.

3. **Email infrastructure (Lovable Emails).**
   - `email_domain--check_email_domain_status` → set up domain → `setup_email_infra` → `scaffold_transactional_email`.
   - Templates: `booking-confirmation-customer`, `booking-notification-owner`, `lead-captured-owner` (fallback when no booking).

4. **Customer + owner notifications.**
   - On successful booking: send customer SMS (Twilio) + customer email (Lovable Emails) + owner SMS (already working) + owner email.
   - On lead-without-booking: owner SMS (working) + owner email; no customer message (avoid spam).
   - Trigger from `vapi-webhook` after the appointment row is created.

5. **Per-tenant Google OAuth (production mode).**
   - Google Cloud OAuth client (calendar.events scope).
   - New edge functions: `google-oauth-start`, `google-oauth-callback`, `google-token-refresh`.
   - Setup wizard step: "Connect your Google Calendar" with status badge.
   - Calendar functions choose per-tenant tokens when present, else fall back to workspace connector (test mode).

6. **Polish + verification.**
   - End-to-end test script: place test call → verify lead, appointment, calendar event, 2 SMS, 2 emails, inbox row.
   - Surface booking status in inbox + dashboard cards.

## Technical notes

- The Lovable `google_calendar` connector reaches `https://connector-gateway.lovable.dev/google_calendar/calendar/v3` and only ever talks to the builder's calendar — fine for test mode, must not be used for tenants in production.
- Per-tenant OAuth must store refresh tokens server-side; never expose to the browser. Use service-role-only access plus the existing `owns_client` pattern for client-side reads of *status only*.
- Vapi tool definitions for `findSlots` and `bookSlot` need to be attached to each provisioned assistant in `provision-twilio-number` so the AI can call them mid-conversation.
- Email infra prerequisite chain (`check_email_domain_status` → `setup_email_infra` → `scaffold_transactional_email`) must run before any send code is written.

## Estimated effort to MVP

| Step | Effort |
|---|---|
| 1. Schema + columns | S |
| 2. Calendar (test mode) + assistant tools | M |
| 3. Email infra + templates | S–M (mostly tool-driven) |
| 4. Confirmation/notification fan-out | S |
| 5. Per-tenant Google OAuth | M–L |
| 6. E2E verification | S |

Recommend executing steps 1–4 first to hit "working MVP on the test calendar", then 5 to unlock production tenants.

---

Want me to proceed with **step 1 + step 2 (schema + Google Calendar test mode wired into the Vapi assistant)** as the next build, or a different sequence?
