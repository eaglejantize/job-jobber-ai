# Voice Verification — Hardening + Run (revised, incorporates all 5 corrections)

Scope: only `supabase/functions/verify-voice-catalog/index.ts` and one invocation. No catalog inserts, no tenant assistant writes, no publish, no unrelated changes.

## Changes to `supabase/functions/verify-voice-catalog/index.ts`

### 1. Preview playback (correction #1)
Rewrite `checkPreview` to require **all** of:
- HTTP status in 200–299 (any non-2xx = fail, including 401/403/404/5xx).
- Body inspection of the first ~2 KB.
- Pass criteria:
  - `Content-Type` starts with `audio/`, or is `application/ogg`, `video/mp4`, `application/mp4`; OR
  - `Content-Type` is `application/octet-stream` / `binary/octet-stream` / missing AND the first bytes match a known audio signature (ID3, MP3 frame sync `0xFFEx`, `RIFF….WAVE`, `OggS`, `....ftyp` for MP4/M4A, `fLaC`).
- Explicit reject when `Content-Type` is `text/*`, `application/json`, `application/xml`, or contains `html`, regardless of size. Provider error JSON therefore fails.
- Response object: `{ result: 'pass'|'fail'|'skipped', status, content_type, reason }`.

### 2. HEAD → GET fallback (correction #2)
- Try `HEAD` first.
- Retry with ranged `GET` (`Range: bytes=0-2047`) when HEAD returns 405, 403, network error, or an ambiguous content-type with no body.
- HEAD 404 may be retried with GET **for diagnostic confirmation only**; pass still requires a fresh 2xx audio response from GET. A 404 body is never accepted.
- Note: original preview URL from provider is used verbatim; no URL rewriting.

### 3. Scratch-assistant cleanup (correction #3)
Capture `originalVoice` at scratch creation (the seed voice we passed in on POST). At end of run, in independently guarded blocks:
```
try { PATCH scratch -> originalVoice; restore_attempted=true; restored=ok }
  finally {
    try { GET scratch; restore_verified = (voice matches originalVoice) }
    finally {
      try { DELETE scratch; delete_attempted=true; deleted=ok }
    }
  }
```
Report all five flags separately in the `safety` block: `restore_attempted`, `restored`, `restore_verified`, `delete_attempted`, `deleted` (each `true|false`, plus a short `reason` on failure).

### 4. Bounded run (correction #4)
- Deduplicate candidates by key `${provider.toLowerCase()}:${provider_voice_id.trim().toLowerCase()}`.
- Cap at `MAX_CANDIDATES = 40` (well above the required 12; enough headroom for failures).
- Sequential processing (no `Promise.all`) with a 150 ms pause between candidates to stay under provider rate limits.
- Selection when no explicit `candidates` param: take Vapi native voices first, then ElevenLabs from `/voice-library`, mixing to ensure both providers are represented, up to the cap.

### 5. Secret redaction in output (correction #5)
- `redact(s)` helper strips:
  - `Bearer\s+\S+`
  - JWT-shaped tokens `eyJ…\.…\.…`
  - Exact matches of `VAPI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` env values.
  - Truncates to 240 chars.
- Applied to every `notes` field and every echoed error `body`. Provider response bodies are never returned raw; only status + redacted excerpt.
- Response never includes request headers, auth header, apikey, or full provider payloads. Voice IDs and preview URL host/path are allowed.

### Response shape
```
{
  available_count: number,
  tested: number,
  passed: number,
  passed_min_12: boolean,
  rows: VerifyRow[],   // display_name, provider, provider_voice_id,
                       // provider_lookup, preview_url, preview_status,
                       // preview_content_type, preview_playback,
                       // vapi_update, vapi_reread, verified_active, notes
  safety: {
    scratch_assistant_id, seed_voice,
    restore_attempted, restored, restore_verified,
    delete_attempted, deleted, reasons?
  }
}
```

## Run + report
1. Deploy only `verify-voice-catalog`.
2. Invoke via `supabase--curl_edge_functions` POST with empty body (uses signed-in super-admin session).
3. Return the full table + safety block verbatim, redacted.
4. If `passed < 12`, stop, list per-row blockers, propose nothing, seed nothing.
5. Wait for explicit approval before any `INSERT` into `callcapture_voice_catalog`.

## Out of scope
Seeding rows, tenant assistant edits, UI changes, other functions, other tabs, publish.
