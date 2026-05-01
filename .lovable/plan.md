## Plan: Build `send-demo-sms` edge function

### 1. Add 3 runtime secrets
- `TWILIO_FROM_NUMBER` = `+13027473683`
- `DEMO_OWNER_PHONE` = `+19048927004`
- `VAPI_WEBHOOK_SECRET` = `callcapture_secret_2026`

(Twilio connector is already linked → `TWILIO_API_KEY` and `LOVABLE_API_KEY` are available.)

### 2. Create `supabase/functions/send-demo-sms/index.ts`
- Public webhook endpoint (no JWT) called by Vapi end-of-call reports
- CORS headers on every response (incl. errors), OPTIONS preflight
- **Auth:** require header `x-webhook-secret` == `VAPI_WEBHOOK_SECRET`; return 401 otherwise
- **Parse Vapi payload** flexibly — extract from any of:
  - `message.analysis.structuredData.{name, phone, issue, urgency, type}`
  - `message.artifact.structuredData.*`
  - `analysis.structuredData.*`
  - top-level `{name, phone, issue}` (for manual tests)
  - fallback: `message.summary` / `summary` for the issue field
- **Validate** with Zod: `name` (string, 1–120), `phone` (string, 5–25), `issue` (string, 1–800), optional `urgency`, optional `type` (e.g. "Existing Customer Request")
- **Compose SMS** (≤ 480 chars, single MMS-safe):
  ```
  📞 New CallCapture Lead
  Name: {name}
  Phone: {phone}
  {type ? "Type: "+type+"\n" : ""}{urgency ? "⚠️ URGENT\n" : ""}Issue: {issue}
  ```
- **Send via Twilio gateway** (`https://connector-gateway.lovable.dev/twilio/Messages.json`, form-urlencoded, From=`TWILIO_FROM_NUMBER`, To=`DEMO_OWNER_PHONE`)
- Return `{ success: true, sid }` on 2xx, otherwise 502 with the Twilio error body
- Wrap everything in try/catch; log `console.error` on failures (no secret values logged)

### 3. `supabase/config.toml`
Leave unchanged — default `verify_jwt = false` for new functions is what we need; no project-level edits.

### 4. After deploy — what you do in Vapi
1. Server URL → `https://mzqazxtcwqumroqtmtjd.supabase.co/functions/v1/send-demo-sms`
2. Server URL Headers → add `x-webhook-secret: callcapture_secret_2026`
3. Server Messages → enable `end-of-call-report` (and optionally `status-update`)
4. Assistant → Analysis → **Structured Data** schema:
   ```
   { name: string, phone: string, issue: string,
     urgency: boolean, type: string }
   ```
   So Vapi populates `message.analysis.structuredData`.

### 5. Test after deploy
Curl from my side:
```
POST /functions/v1/send-demo-sms
x-webhook-secret: callcapture_secret_2026
{ "name":"Test User","phone":"+15555550123","issue":"AC not cooling","urgency":true }
```
Expect `200 { success:true, sid:"SM..." }` and a real SMS to `+19048927004`.

### Security recommendations (do after first successful test)
- In Twilio Console: enable **SMS Pumping Protection**
- Twilio **Messaging Geo Permissions** → enable only US (and CA if needed)
- Rotate `VAPI_WEBHOOK_SECRET` if it ever gets pasted publicly

### Out of scope
- No DB writes (lead persistence) — easy to add later if you want a leads table + dashboard
- No retry queue — Vapi will retry the webhook on non-2xx, which is sufficient

Approve and I'll add the 3 secrets, write the function, deploy it, and run the test call.