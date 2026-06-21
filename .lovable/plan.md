## Audit of `supabase/functions/send-sms/index.ts`

### 1. Every `Deno.env.get()` call
- `Deno.env.get("SUPABASE_URL")` ✅ present
- `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` ✅ present
- `Deno.env.get("TWILIO_API_KEY")?.split(":")[0]` → tries to parse `accountSid` from `"SID:TOKEN"` format
- `Deno.env.get("TWILIO_ACCOUNT_SID")` (fallback) ❌ not set
- `Deno.env.get("TWILIO_API_KEY")?.split(":")[1]` → tries to parse `authToken` from `"SID:TOKEN"` format
- `Deno.env.get("TWILIO_AUTH_TOKEN")` (fallback) ❌ not set
- `Deno.env.get("TWILIO_FROM_NUMBER")` ✅ present

### 2. Why it returns `"Twilio not configured"`
`TWILIO_API_KEY` is supplied by the **Lovable Twilio connector**. That value is a single connector key — **not** a `"SID:TOKEN"` string. So:
- `split(":")[0]` returns the whole key (accountSid ends up = the connector key, wrong but truthy)
- `split(":")[1]` returns `undefined` → `authToken` is `undefined`
- The `!authToken` branch fires → `"Twilio not configured"`

### 3. Variable names the code looks for
`TWILIO_API_KEY` (expects `SID:TOKEN` form), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. It does **not** look for `TWILIO_PHONE_NUMBER`, `TWILIO_SID`, or `TWILIO_TOKEN`.

### 4. Fix — use the existing connector secrets via the Lovable gateway

The Twilio connector is designed to be called through `https://connector-gateway.lovable.dev/twilio/...` with:
- `Authorization: Bearer ${LOVABLE_API_KEY}`
- `X-Connection-Api-Key: ${TWILIO_API_KEY}`

The gateway injects the Account SID automatically. No `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` secret needs to be added.

**Rewrite `send-sms/index.ts`** to:
1. Keep the existing lead/client lookup and message-body composition.
2. Replace the `accountSid` / `authToken` block and the direct `api.twilio.com` fetch with a single gateway call:
   ```ts
   const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
   const TWILIO_API_KEY  = Deno.env.get("TWILIO_API_KEY");
   const fromNumber      = Deno.env.get("TWILIO_FROM_NUMBER");
   if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !fromNumber) {
     return 500 { error: "Twilio not configured", missing: [...] };
   }
   await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
     method: "POST",
     headers: {
       Authorization: `Bearer ${LOVABLE_API_KEY}`,
       "X-Connection-Api-Key": TWILIO_API_KEY,
       "Content-Type": "application/x-www-form-urlencoded",
     },
     body: new URLSearchParams({ From: fromNumber, To: client.alert_phone, Body: body }).toString(),
   });
   ```
3. Report the exact missing variable name in the error response so future misconfig is obvious.
4. Deploy `send-sms` and curl-test it against a known lead/client.

### No additional secrets required
All three needed env vars (`LOVABLE_API_KEY`, `TWILIO_API_KEY`, `TWILIO_FROM_NUMBER`) are already configured.
