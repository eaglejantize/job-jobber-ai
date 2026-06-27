## Audit Results

### 1. Owner SMS — ⚠️ Needs Fix
- `send-sms` IS wired into `vapi-webhook` and fires on `end-of-call-report` to `client.alert_phone` via Twilio gateway.
- **Gap**: body has no appointment confirmation. It lists lead fields (name, phone, service, timing, status, referral) but never mentions that a booking was created or when.
- Current body:
  ```
  New {Business} lead
  Name: Jane Doe
  Phone: +15551234567
  Service: AC repair
  When: tomorrow morning
  ```

### 2. Customer SMS — ✅ Built, conditional
- `send-customer-sms` exists and fires from `vapi-webhook` only when `lead.appointment_id` is set (i.e., `bookSlot` tool ran).
- Goes to `appt.customer_phone` (captured from caller).
- Body:
  ```
  Hi Jane, this confirms your AC repair with Acme HVAC on Monday, Jul 1, 9:00 AM.
  Address on file: 123 Main St
  Reply to this message if anything changes.
  ```
- Confirmed working assuming `TWILIO_FROM_NUMBER` is set and `customer_phone` was captured.

### 3. Vektuor Inbox (real time) — ⚠️ Partial
- Realtime publication includes `callcapture_leads` and `callcapture_calls`. `LeadInbox.tsx` and `useCalls` both subscribe correctly — new leads/call rows surface without refresh.
- **Gap**: `calendar-book-slot` updates the lead's `booking_status='booked'` but never flips the linked `callcapture_calls.status` to `booked`. So the Dashboard call card stays `live`/`completed` and never visibly transitions to "booked" in real time.
- **Gap**: lead row lacks the appointment time on the surface — `LeadCard` shows raw fields but a booked lead doesn't display the scheduled `start_at` prominently.

---

## Fixes

### A. `supabase/functions/send-sms/index.ts`
Look up `lead.appointment_id`; if present, fetch `callcapture_appointments` (`start_at`, `service`) and prepend a `BOOKED for {formatted time}` line. Format using client `timezone`.

### B. `supabase/functions/calendar-book-slot/index.ts`
After inserting the appointment and updating the lead, also:
- Find the matching `callcapture_calls` row (via `lead_id` or `vapi_call_id`) and update `status='booked'`, `lead_id` (if missing).
- This pushes a realtime UPDATE to the Dashboard so the call card flips to "booked" instantly.

### C. `src/components/LeadCard.tsx` (light touch)
When `appointment_id` is present, fetch and render a "Booked: {time}" badge at the top of the card. Subscribes to `callcapture_appointments` insert for the lead so the inbox shows the booking immediately.

### D. Deploy
Redeploy `send-sms`, `calendar-book-slot`. No schema changes required (appointment_id, booking_status already exist).

---

## Out of scope
- Email confirmations (`send-appointment-emails`) — pending DNS verification; not blocking.
- ServanaHQ sync — already fire-and-forget.

After approval I'll apply A–D and confirm with edge function logs.