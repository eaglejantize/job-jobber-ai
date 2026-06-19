## Plan

1. **Disable voice preview/audio paths**
   - In `AiSettingsPanel`, stop calling `list-vapi-voices` and remove the `new Audio(...)` preview behavior.
   - Keep voice selection visible using the existing fallback/static voice cards.
   - Replace every voice preview/play button with a small `Preview coming soon` badge.
   - Update `VoicePicker` the same way so no UI path attempts to play audio.

2. **Fix `/leads` inbox with a secure service-role read**
   - Add a new backend function (for example `list-leads`) that uses the service-role client server-side, not in browser code.
   - Validate the logged-in user from the request token, resolve their `callcapture_clients` row by `user_id` first and email fallback second.
   - Fetch leads through the service-role client so RLS cannot hide them:
     - leads matching the resolved `client_id`
     - leads where `client_id IS NULL`
     - temporary debug fallback: all recent leads found, deduped and sorted newest first, so the inbox can show the existing lead immediately
   - Return the resolved `client_id` and lead rows to the frontend.
   - Keep the SMS flow untouched.

3. **Update `/leads` UI display**
   - Change `LeadInbox` to call the new backend function instead of querying `callcapture_leads` directly from the browser.
   - Display every returned lead regardless of `client_id` match.
   - Keep the debugging `client_id` line on each card.
   - Extend `LeadCard` to show the requested fields clearly: caller name, phone, address, service type, issue description, and timestamp.

4. **Add industry editing to Settings Business Info**
   - Use the existing 24-industry list from `src/lib/industries.ts` as the Business Info dropdown.
   - Save the selected value to both the existing business record and `callcapture_clients.industry` so AI Settings sees the current industry.

5. **Med spa intake + greeting behavior**
   - Update `questionsForIndustry('med_spa')` to include the requested pre-checked intake set:
     - Caller name
     - Phone number
     - Best callback time
     - Service interested in (Botox, filler, laser, facial, etc.)
     - New or returning client
     - Preferred provider or no preference
     - Any allergies or skin sensitivities
     - Preferred appointment day/time
     - How did you hear about us
   - Show the current industry label at the top of AI Settings.
   - When the current industry is `med_spa` and no custom greeting has been set, use: `Thank you for calling [Business Name], your personal concierge is here. How may I assist you today?`
   - Ensure saving AI Settings persists the selected intake questions and greeting on `callcapture_clients`.

6. **Validation**
   - Verify `/leads` renders returned leads with debug `client_id` and required fields.
   - Verify changing industry in Settings updates the AI Settings label and med spa defaults.
   - Verify no voice preview/audio endpoint or playback path is triggered from the UI.