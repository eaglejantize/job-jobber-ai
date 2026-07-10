# Plan: Temporary Vapi Voice Verification Runner

Add a temporary, super-admin-only UI action that invokes the existing `verify-voice-catalog` edge function using the authenticated Supabase browser client (so the session JWT is auto-forwarded), then renders the full JSON result. No backend/secret changes.

## Scope

- Frontend only. No changes to `verify-voice-catalog/index.ts` (server-side super-admin check stays authoritative).
- No catalog inserts, no tenant assistant edits, no phone-setup changes, no publish.

## Where it goes

`src/pages/Admin.tsx` is already gated by `ProtectedAdminRoute` (checks `is_super_admin` via `useIsAdmin`). Add a new "Voice Verification (temporary)" section there.

## New component

`src/components/admin/VoiceVerificationRunner.tsx`

Behavior:

1. On mount, read current session/user via `supabase.auth.getSession()` and `supabase.auth.getUser()`. Show:
   - signed-in email
   - whether a session/access token exists
   - a warning banner if email !== `eaglejantize@gmail.com` (informational only — server enforces auth)
2. Button: **"Run Vapi Voice Verification"**.
3. On click:
   - Re-check `supabase.auth.getSession()`. If none: show `"You must sign in again before running verification."` and stop.
   - Call `supabase.functions.invoke("verify-voice-catalog", { body: {} })`. This forwards the current user JWT as `Authorization: Bearer <token>` automatically.
   - Also capture HTTP status. Because `functions.invoke` doesn't expose status directly on success, use a parallel raw `fetch` variant when `invoke` returns an error, so we can display the raw status + response body for 401/403 cases:
     - Build URL from `import.meta.env.VITE_SUPABASE_URL` + `/functions/v1/verify-voice-catalog`.
     - Send `Authorization: Bearer ${session.access_token}` and `apikey: <publishable key>`.
     - Read `res.status`, `res.headers`, and `await res.text()` (parse JSON when possible).
   - Prefer the raw `fetch` path for full fidelity (status + body always available); fall back to `invoke` only if needed. Both use the same forwarded JWT.
4. Render results:
   - **HTTP status**
   - **Diagnostics block** (session present, user email, access token present, Authorization header sent yes/no) — token value itself never displayed; only presence booleans and last-4 chars.
   - **Verification table** from `rows[]`: columns display_name, provider, provider_voice_id, scratch_patch, assistant_reread, preview_method, preview_playback, verified_active, failure_reason.
   - **Safety cleanup block** from `safety` (scratch_assistant_id, restore_attempted/restored/restore_verified, delete_attempted/deleted, reasons).
   - **Totals**: `candidates_tested`, `verified`, `passed_min_12`.
   - **Complete JSON response** in a collapsible `<pre>`.
5. Error handling:
   - For non-2xx: show status + response body verbatim, but run it through a small `redactSecrets()` helper that masks Bearer tokens, JWT-shaped strings, and any `apikey`/`authorization` header values.
   - For network errors: show the thrown message (redacted).

## Redaction helper (client-side, mirrors server)

Regexes for `Bearer\s+[A-Za-z0-9._~+/=-]+`, JWT triple-segment pattern, and any string longer than 40 chars matching `[A-Za-z0-9._-]+` in header/body dumps → replaced with `[REDACTED]`.

## Admin page integration

In `src/pages/Admin.tsx`, add a new card/section labeled **"Voice Verification (temporary)"** with a short note: "Temporary diagnostic — remove after voice catalog is approved." Render `<VoiceVerificationRunner />` inside it.

## Files touched

- Add: `src/components/admin/VoiceVerificationRunner.tsx`
- Edit: `src/pages/Admin.tsx` (import + render one section)

Nothing else changes. No edge function edits, no migrations, no secrets, no publish.

## Post-implementation manual verification (user performs)

1. Sign out of preview.
2. Sign back in as `eaglejantize@gmail.com`.
3. Hard refresh `/admin`.
4. Click **"Run Vapi Voice Verification"**.
5. Return the complete JSON result.

If still 401, the diagnostics block will report:
- `getSession()` returned a session? (bool)
- authenticated user email
- access token present? (bool, last-4 only)
- Authorization bearer header sent? (bool)
- server response body (redacted) — which will indicate whether the server rejected at JWT validation (`Unauthorized`) or super-admin check (`Forbidden — super admin only`).
