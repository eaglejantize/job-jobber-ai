## Plan: Fix lead capture flow end-to-end

### 1. `supabase/functions/vapi-webhook/index.ts` — rewrite client lookup

Replace the dialed-number matching block with the two-tier lookup the user specified:

- **First try:** match dialed `phoneNumber` from the Vapi payload against `callcapture_clients.business_phone` (digits-normalized). Log `[vapi-webhook] matched by business_phone`.
- **Second try:** `is_super_admin = true` (single-owner fallback). Log `[vapi-webhook] matched by super_admin fallback`.
- Keep `?client_id=` / `metadata.client_id` as highest precedence (explicit override).
- If a match is found *after* insert (i.e. clientId resolved late), `UPDATE callcapture_leads SET client_id = ... WHERE id = lead.id`. In practice we resolve before insert, but we'll still do an UPDATE step explicitly so the flow matches the spec and survives future refactors.
- After insert + linkage, fetch `alert_phone` from the matched client and POST to `send-sms` (already in place; we'll keep but ensure it runs after the linkage UPDATE).

### 2. New edge function: `supabase/functions/submit-intake/index.ts`

Called by the Vapi agent as a tool at end of conversation.

Accepts POST JSON:
```
{
  business_phone, caller_name, caller_phone,
  service_requested, appointment_preference,
  new_or_returning, referral_source, notes
}
```

Logic:
- CORS preflight handler.
- Zod-validate body; 400 on failure.
- Service-role Supabase client.
- Look up client: `callcapture_clients` where digits(`business_phone`) = digits(input business_phone). If none, fall back to `is_super_admin = true`. Log which matched.
- Insert into `callcapture_leads`:
  - `client_id`, `name: caller_name`, `phone: caller_phone`,
  - `treatment: service_requested`, `timing: appointment_preference`,
  - `new_or_returning`, `referral: referral_source`,
  - `summary: notes`, `status: "New"`,
  - `raw_payload: { source: "submit-intake", ...body }`.
- If `client.alert_phone` present, call `send-sms` with `{ client_id, lead_id }` (reuses existing SMS function — no duplicate Twilio logic).
- Return `{ success: true, lead_id }`.
- Deploy with `verify_jwt = false` (public — Vapi calls it). Will be added to `supabase/config.toml`.

### 3. Vapi tool definition (output in chat after build)

After the function deploys, I'll output the exact JSON to paste into the Vapi assistant's Tools section, including:
- `type: "function"`, `name: "submitIntake"`
- `description` instructing the agent to call it once all intake fields are collected and before closing the call
- `parameters` schema for all 8 fields (all required except `notes`)
- `server.url` pointing at `<SUPABASE_URL>/functions/v1/submit-intake`
- `messages` for `request-start` / `request-complete` so the agent says a brief confirmation while the tool runs

I'll also note that the user should add a sentence to the assistant's system prompt: *"Once you have collected the caller's name, phone, service requested, appointment preference, whether they're new or returning, and how they heard about us, call the submitIntake tool with the business_phone of this assistant before saying goodbye."*

### Out of scope
- No changes to inbox, AI Settings, `update-vapi-agent`, or `send-sms` body formatting (already structured).
- No schema migrations — all target columns already exist on `callcapture_leads`.
