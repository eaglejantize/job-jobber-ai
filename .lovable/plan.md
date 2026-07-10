Update the temporary `src/components/admin/VoiceVerificationRunner.tsx` diagnostics panel to add export controls and a visible summary.

Changes:
- Add a **"Copy Full JSON"** button that copies the complete unmodified verification response (`result.body`, JSON-stringified) to the clipboard using the Clipboard API. On failure, show a brief inline message.
- Add a **"Download JSON"** button that downloads the same response as `vapi-voice-verification.json` using a temporary anchor element with a `Blob`.
- Both buttons must work on the verified HTTP 200 response and must not expose access tokens, authorization headers, API keys, service-role keys, or secrets. (The response payload already contains only verification metadata and safety flags; no secrets are stored in it.)
- Add a new collapsible section labeled **"Raw Verification Response"" that displays `JSON.stringify(response, null, 2)` in a `<pre>` block.
- Above the verification table, show a visible summary grid with:
  - total candidates tested
  - total passed
  - total failed
  - passed_min_12
  - scratch assistant restored (from `safety.restored`)
  - scratch assistant deleted (from `safety.deleted`)
- Ensure the verification table stays horizontally scrollable on mobile/tablet by keeping a wrapper with `overflow-auto` and a min-width table layout.
- Keep the existing verification table, diagnostics block, and safety cleanup block.
- No automatic re-run of verification.
- No catalog seeding, no tenant assistant edits, no phone-setup changes, no publish, no new secrets.

Files touched:
- Edit `src/components/admin/VoiceVerificationRunner.tsx` only.

After implementation, the user will click "Copy Full JSON" or "Download JSON" themselves.