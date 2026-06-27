## Root cause

In `supabase/functions/vapi-webhook/index.ts`, `send-transactional-email` is only reached indirectly via `send-appointment-emails`, and only when the lead has an `appointment_id`. Since the AI almost never invokes `bookSlot` on test calls, no email ever fires. The tenant row for `eaglejantize@gmail.com` also has `owner_email = NULL` (only `email` is set), so any future trigger must fall back to `email`.

Customer SMS path is unaffected and stays as-is. Owner SMS (`send-sms`) is already working.

## What to build

### 1. New email template: `new-lead-owner`
File: `supabase/functions/_shared/transactional-email-templates/new-lead-owner.tsx`

React Email component matching the existing Vektuor branding (navy header, blue button). Fields:
- `business_name`, `caller_name`, `caller_phone`, `service`, `timing`, `summary`, `transcript_excerpt`, `dashboard_link`
- Subject: `New call lead: {caller_name or "Unknown"} — {business_name}`

### 2. Register the template
Add to `supabase/functions/_shared/transactional-email-templates/registry.ts`:
```ts
import { template as newLeadOwner } from './new-lead-owner.tsx'
// ...
'new-lead-owner': newLeadOwner,
```

### 3. Fire owner email unconditionally on `end-of-call-report`
In `vapi-webhook/index.ts`, after the lead insert block (around line 267), add a new block that runs whenever `clientId` is set — independent of `leadId` and independent of `appointment_id`:

- Fetch `business_name, owner_email, email, timezone` from `callcapture_clients`.
- Resolve recipient: `owner_email || email`. If missing, log `owner_email_sent` `skipped` `{reason: "no_owner_email"}`.
- Invoke `send-transactional-email` with:
  - `templateName: "new-lead-owner"`
  - `recipientEmail: <resolved>`
  - `idempotencyKey: \`owner-lead-${vapiCallId}\``
  - `templateData: { business_name, caller_name, caller_phone, service: extracted.service, timing: extracted.timing, summary: summary || extracted.notes, transcript_excerpt: transcriptText?.slice(0, 1500), dashboard_link: "https://vektuor.com/dashboard" }`
- Log result via `logEvent(..., "owner_email_sent", ok/error, {status, body})`.

The existing booking-only `send-appointment-emails` call stays — it provides the richer customer+owner confirmation when a booking actually happens.

### 4. Customer email behavior (unchanged)
Customer email continues to fire only when an appointment exists and the lead/appointment has a customer email captured. No change required — `send-appointment-emails` already skips with `no_email` when missing.

## Files touched
- `supabase/functions/_shared/transactional-email-templates/new-lead-owner.tsx` (new)
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (add entry)
- `supabase/functions/vapi-webhook/index.ts` (add owner-email block in `end-of-call-report`)

## Verification
After deploy, place a test call. Expect in `callcapture_webhook_events`: `owner_email_sent` `ok`, and a row in `email_send_log` with `template_name='new-lead-owner'` going to `Eaglejantize@gmail.com`. The email lands once DNS/queue is healthy (already verified per user).
