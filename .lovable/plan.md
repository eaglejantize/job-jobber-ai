## Vapi-native only voice verification

Rework `supabase/functions/verify-voice-catalog/index.ts` to verify a fixed candidate list of Vapi-native voices without any external provider dependency, without hitting non-existent `/voice` or `/voice-library` endpoints, and without inventing preview URLs.

### Scope guardrails (unchanged)
- Do not seed `callcapture_voice_catalog`.
- Do not touch tenant assistants.
- Do not modify phone setup, publish, or add secrets.
- Do not request `ELEVENLABS_API_KEY`.
- Wait for explicit approval before any seeding.

### Candidate list (hardcoded, Vapi-native only)
All candidates use `provider: "vapi"`:
`Emma, Nico, Sagar, Kai, Neil, Clara, Godfrey, Layla, Sid, Naina, Elliot`

No ElevenLabs, PlayHT, Cartesia, Azure. No retired legacy IDs. No enumeration call.

### Provider-lookup definition (Vapi has no list endpoint)
For each candidate:
1. `PATCH /assistant/{scratchId}` with `{ voice: { provider: "vapi", voiceId: "<Name>" } }`.
2. Require 2xx.
3. `GET /assistant/{scratchId}` and require the returned `voice.provider === "vapi"` and `voice.voiceId === "<Name>"` (case-insensitive compare, exact-string reported).
4. Both must pass → `provider_lookup = pass`. Otherwise `fail` with the exact Vapi error body (redacted).

### Preview verification
Vapi does not expose per-voice preview URLs programmatically for its native voices, so use a controlled scratch mechanism:

- After a successful PATCH + re-read for a candidate, call Vapi's `/call` API in `type: "outboundPhoneCall"` mode? **No** — that would place a real phone call and is out of scope.
- Instead, use Vapi's **`POST /call` with `type: "webCall"`** against the scratch assistant. A webCall returns a `webCallUrl` and, in the transcript/artifact webhook, an audio recording. That requires a live browser, so it is not usable inside an edge function.

Because there is no legitimate, headless, per-voice audio artifact endpoint on Vapi for native voices, the honest preview method is:

- `preview_method = "scratch_assistant_configured"` — meaning the scratch assistant is provably configured with the exact voiceId (verified by the re-read step). No fake preview URL will be fabricated; `preview_url` stays `null`.
- `preview_playback` will be reported as `"skipped_no_programmatic_source"` with a note that a human-audible preview requires either (a) placing an outbound test call, or (b) opening a webCall against the scratch assistant in the browser — both explicitly out of scope for this verifier per current instructions.

If the user wants human-audible previews confirmed inside this run, we would need approval to either:
- allow the verifier to trigger one outbound test call per voice to a designated test number, or
- ship a small UI tool that starts a webCall against the scratch assistant per voice.

Either path is added only after explicit approval — this plan does not include them.

### Scratch assistant safety (unchanged)
- Create dedicated `voice-verify-<ts>` scratch assistant seeded with a known-good Vapi-native voice (first candidate that PATCH-succeeds; if none, abort with clear reason and still attempt delete).
- Record `originalVoice`.
- In `finally`: PATCH back to `originalVoice`, GET to verify, then DELETE. Report `restore_attempted`, `restored`, `restore_verified`, `delete_attempted`, `deleted`.
- Sequential candidates, 150 ms pause, `MAX_CANDIDATES = 40` (list is 11).

### Response shape
```json
{
  "candidates_tested": 11,
  "verified": <n>,
  "passed_min_12": false,
  "rows": [{
    "display_name": "Emma",
    "provider": "vapi",
    "provider_voice_id": "Emma",
    "scratch_patch": "pass|fail",
    "assistant_reread": "pass|fail|skipped",
    "preview_method": "scratch_assistant_configured",
    "preview_playback": "skipped_no_programmatic_source",
    "verified_active": false,
    "failure_reason": ""
  }],
  "safety": { "scratch_assistant_id", "seed_voice", "restore_attempted", "restored", "restore_verified", "delete_attempted", "deleted", "reasons": [] }
}
```

`verified_active` requires `scratch_patch = pass` AND `assistant_reread = pass`. Since no honest audible preview is produced in this run, **no voice will be marked production-ready from this run alone** — the user gets an accurate PATCH/re-read matrix and can then approve a preview mechanism.

If `verified < 12`, stop; report count and blockers; propose no fill-ins.

### Execution steps after approval
1. Overwrite `supabase/functions/verify-voice-catalog/index.ts` with the new logic (no enumeration, hardcoded list, no preview URL fabrication).
2. Deploy `verify-voice-catalog`.
3. `POST` it as the signed-in super-admin with empty body.
4. Return the verification table + safety block.
5. Ask the user which preview mechanism to authorize (outbound test call vs. in-browser webCall tool) before anything is marked production-ready or seeded.

### Out of scope
Seeding catalog, tenant edits, other functions, UI changes, publish, external providers, adding secrets.
