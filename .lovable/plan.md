## Fix "Copy failed" in Voice Verification panel

The preview runs in a cross-origin iframe where `navigator.clipboard.writeText` is blocked by Permissions Policy, so it throws and we show "Copy failed."

### Change (only `src/components/admin/VoiceVerificationRunner.tsx`)

Update `copyJson()` to try multiple strategies in order:

1. Try `navigator.clipboard.writeText(fullJson)` (works on published site / same-origin).
2. On failure, fall back to a hidden `<textarea>` + `document.execCommand("copy")` (works inside sandboxed iframes that allow copy).
3. If that also fails, select the JSON in the Raw Verification Response `<pre>` (auto-open the `<details>`, create a Range + Selection over it) and show a message: "Clipboard blocked in preview — text selected, press Ctrl/Cmd+C to copy, or use Download JSON."

Also:
- Give the `<pre>` inside "Raw Verification Response" a stable `ref` so the fallback can select it.
- Keep the existing success/failure toast, but extend messages: "Copied to clipboard." / "Selected — press Ctrl/Cmd+C." / "Copy failed — use Download JSON."
- No change to Download JSON (already works via Blob).
- No change to verification logic, no re-run, no other files touched.
