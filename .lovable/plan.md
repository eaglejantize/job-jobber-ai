
# Build plan: bookings, confirmations, and Vektuor branding

## 1. Google Calendar booking (test mode) wired into Vapi

Most of this is already in place. Remaining gaps:

- **Re-attach tools to existing assistants.** `provision-twilio-number` already attaches `findSlots` / `bookSlot` to new assistants, but tenants provisioned earlier have no tools. Update `update-vapi-agent` to also PATCH the assistant's `model.tools` and `serverUrl` so the "Update Agent" button re-syncs calendar tools on existing tenants.
- **Confirm `vapi-tools` reachability.** Verify `supabase/config.toml` has `verify_jwt = false` for `vapi-tools` (Vapi calls it without auth). Add the block if missing.
- **Test-mode auth.** Continues to use the existing Google Calendar workspace connector via `GOOGLE_CALENDAR_API_KEY` until per-tenant OAuth (phase 5) lands.

No schema changes — `callcapture_appointments` and the calendar columns on `callcapture_clients` already exist.

## 2. Email infrastructure with notify.vektuor.com

Domain + infra are already set up. Need to scaffold templates:

- Run `scaffold_transactional_email` to create `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, and the template registry.
- Run `scaffold_auth_email_templates` to brand signup / magic-link / recovery / invite / email-change / reauthentication emails as Vektuor.
- Add two new transactional templates branded as Vektuor:
  - `appointment-confirmation-customer` — confirms time, address, business name, calendar link.
  - `appointment-notification-owner` — alerts the owner with customer name, phone, address, service, time, notes.
- Apply Vektuor visual identity (dark navy header, white body, brand accent, sans-serif). Footer reads "Sent by Vektuor on behalf of {business_name}".

## 3. Confirmation fan-out after booking

`vapi-webhook` already triggers `send-customer-sms` and `send-appointment-emails` when a lead has `appointment_id`. Adjustments:

- `send-appointment-emails` already calls `send-transactional-email` with template names `appointment-confirmation-customer` and `appointment-notification-owner` — those names will resolve once templates are scaffolded; no code change required.
- Owner SMS already fires via the existing `send-sms` path on every captured lead. No change needed there.
- Customer SMS via `send-customer-sms` stays as-is (Twilio gateway).

## 4. Rebrand from "Call Capture Pro" to "Vektuor"

- `supabase/functions/create-checkout/index.ts` — Stripe line-item `name: "CallCapture Pro"` → `"Vektuor"`.
- Sweep `src/`, `index.html`, and edge functions for any user-facing "CallCapture" / "Call Capture" strings (NOT table/column names like `callcapture_clients`, which stay) and switch them to Vektuor.
- Email templates (new + scaffolded auth templates) all use "Vektuor" branding from the start.

## 5. Verification

- Lint + typecheck.
- After deploy: trigger a test booking through `place-test-call` and confirm: appointment row created, customer SMS sent (Twilio 201), owner SMS sent, customer email row in `email_send_log` = `sent`, owner email row in `email_send_log` = `sent`.
- Diagnostics panel already shows `customer_sms_sent`, `emails_sent`, etc. — no UI changes needed.

## Out of scope (next phase)

- Per-tenant Google OAuth (phase 5 of the MVP plan) — still uses the workspace calendar in test mode.
- Marketing / bulk emails — not supported by Lovable Emails.

## File list

Edits:
- `supabase/functions/update-vapi-agent/index.ts` — attach calendar tools on PATCH.
- `supabase/functions/create-checkout/index.ts` — rename Stripe product to Vektuor.
- `supabase/config.toml` — ensure `[functions.vapi-tools] verify_jwt = false` if missing.
- Misc user-facing strings under `src/` and `index.html` referencing "Call Capture" → "Vektuor".

New:
- `supabase/functions/_shared/transactional-email-templates/appointment-confirmation-customer.tsx`
- `supabase/functions/_shared/transactional-email-templates/appointment-notification-owner.tsx`
- Scaffolded files from `scaffold_transactional_email` and `scaffold_auth_email_templates` (auto-generated, then re-themed to Vektuor).
