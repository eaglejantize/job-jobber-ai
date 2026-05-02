## Plan: Verify demo lead SMS flow

### Current setup (already in place)
- Edge function `send-demo-sms` is deployed
- Secrets configured:
  - `TWILIO_FROM_NUMBER` = `+19048927004` (Twilio sender)
  - `DEMO_OWNER_PHONE` = `+13027473683` (your phone — receives the alert)
  - `VAPI_WEBHOOK_SECRET` = `callcapture_secret_2026`
  - `TWILIO_API_KEY` (via connector)
- Function validates `x-webhook-secret`, parses Vapi payload, sends SMS via Twilio gateway

### Verification steps (once approved)

**1. Direct test — manual payload (simulates Vapi)**
Hit the deployed function with a clean test lead:
```
POST https://mzqazxtcwqumroqtmtjd.supabase.co/functions/v1/send-demo-sms
Headers: x-webhook-secret: callcapture_secret_2026
Body: {
  "name": "Verification Test",
  "phone": "+15555550123",
  "issue": "Testing SMS delivery to demo owner",
  "urgency": true,
  "type": "Existing Customer Request"
}
```
Expect: `200 { success: true, sid: "SM..." }`

**2. Vapi-shaped payload test**
Hit it again with the nested structure Vapi actually sends, to confirm the extractor works:
```
{ "message": { "analysis": { "structuredData": {
    "name": "Vapi Shape Test",
    "phone": "+15555550199",
    "issue": "Verifying nested payload extraction",
    "urgency": false,
    "type": "New Lead"
} } } }
```
Expect: `200 { success: true, sid: "SM..." }`

**3. Auth rejection test**
Send a request with a wrong secret to confirm the 401 path works (no SMS should fire).

**4. Check edge function logs**
Pull the latest `send-demo-sms` logs to confirm:
- No errors
- Twilio SIDs were returned
- No secret values leaked into logs

**5. Confirm with you**
You check `+13027473683` and tell me which messages arrived. Expected: 2 SMS (urgent + non-urgent), each formatted like:
```
📞 New CallCapture Lead
Name: ...
Phone: ...
Type: ...
⚠️ URGENT  (only on urgent one)
Issue: ...
```

### If any step fails
- 4xx from Twilio → likely Geo Permissions / unverified trial number / A2P 10DLC issue → I'll surface the exact Twilio error code from logs and tell you what to flip in the Twilio Console
- 401 on valid request → secret mismatch → re-check `VAPI_WEBHOOK_SECRET`
- 400 invalid payload → extractor mismatch → I'll adjust `extractFromVapi` to match the real Vapi shape

### Out of scope for this loop
- Configuring Vapi's server URL / structured data schema (you do that in the Vapi dashboard once SMS is verified)
- Persisting leads to a database (separate feature)

Approve to run the tests.