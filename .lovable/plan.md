## Goal
After saving AI Settings, the live Vapi agent should reflect the new prompt, greeting, tone, and intake questions — not just the database row.

## 1. New edge function: `supabase/functions/update-vapi-agent/index.ts`

Input: `{ client_id: string }` (validated with Zod). Auth: require a logged-in user via `getClaims`; allow if `client_id` belongs to the caller OR caller is super admin (`is_current_user_super_admin`).

Steps:
1. Service-role fetch of the `callcapture_clients` row.
2. Resolve the target phone number, preferring `assigned_callcapture_number`, falling back to `business_phone`. For Vektuor specifically, the linked number is `+1 (904) 893-3328`.
3. `GET https://api.vapi.ai/phone-number` with `Authorization: Bearer ${VAPI_API_KEY}`. Match by E.164 normalization of `number` and read `assistantId`. Return a clear error if not found.
4. Build the system prompt from client settings: `industry`, `tone`, `business_name` (only if `include_business_name`), enabled `intake_questions`, plus a short call-flow scaffold reused from `src/lib/receptionistScript.ts` patterns (kept inline in the function — edge functions can't import from `src/`).
5. Build `firstMessage` from `greeting` (fall back to a default concierge line for `med_spa` if empty, matching existing AiSettingsPanel behavior).
6. `PATCH https://api.vapi.ai/assistant/{assistantId}` with:
   ```json
   { "model": { "systemPrompt": "<built prompt>" }, "firstMessage": "<greeting>" }
   ```
7. Return `{ ok: true, assistant_id }` or `{ ok: false, error }` with the upstream message (status + body) so the toast can surface it.

CORS + `verify_jwt = false` default is fine; we validate the JWT in code.

## 2. Auto-sync on Save in AI Settings
In `src/components/settings/AiSettingsPanel.tsx`, after the existing successful DB update, call `supabase.functions.invoke('update-vapi-agent', { body: { client_id } })`. Toast `"Agent updated"` on success and `"Failed to update agent: <message>"` on error. DB save still counts as success even if Vapi sync fails (separate toast).

## 3. Dashboard Quick Action
In `src/pages/Dashboard.tsx`, add an "Update Agent" button to Quick Actions that invokes the same function for the current user's `client_id`, with the same toasts and a loading state.

## 4. Admin "Sync Agent" per row
In `src/pages/Admin.tsx`, add a "Sync Agent" action button on each subscriber row that calls `update-vapi-agent` with that row's `client_id`. Super-admin gate already enforced by RLS + the edge function's admin check.

## 5. Technical notes
- Secret `VAPI_API_KEY` already exists — no new secrets required.
- No DB schema changes.
- No new dependencies.
- Edge function lives at `supabase/functions/update-vapi-agent/index.ts` only (no subfolders).

## Out of scope
- Voice ID syncing to Vapi (waiting on voice preview work).
- Changing how leads or webhooks flow.
