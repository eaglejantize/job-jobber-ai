# Better Business Lookup

Make Step 1 of setup find businesses by name + location, not phone only. Show a ranked list of matches with details so the user picks the right one, with an always-available manual-entry escape hatch. Lay the groundwork for Google Business Profile OAuth as a follow-up.

## Phase 1 — Multi-field search + result picker (this change)

### Edge function: `supabase/functions/business-lookup/index.ts`

Replace the phone-only flow with a flexible search:

- Accept body: `{ name?: string, phone?: string, city?: string, state?: string }`. Require at least one of `name` or `phone`. Trim/validate with zod.
- Build search strategy (Google Places legacy):
  1. If `phone` is present and no `name`: use Find Place from Phone Number (current behavior) to get a single candidate.
  2. If `name` is present: use Text Search (`/maps/api/place/textsearch/json?query=...`) with `query = "<name> <city?> <state?>"`. This returns up to ~20 candidates with name, formatted_address, place_id, rating, types, business_status.
  3. If both `name` and `phone`: run text search, then bias/sort candidates whose details match the phone digits to the top.
- Return `{ found, candidates: [{ place_id, name, address, category, rating, types, business_status }] }` — up to 8 results. No Details call yet (keeps it fast/cheap).
- Add a second action `mode: "details"` with `{ place_id }` that returns the full business object + AI suggestion (same shape as today's `{ business, suggestion }`). Frontend calls this only after the user picks a candidate.
- Keep `suggestWithAI` unchanged; only call it in the details step.

### UI: `src/setup/steps.tsx` `Step1FindBusiness`

- Replace the single phone field with a small form:
  - Business name (text)
  - Phone (optional)
  - City (optional), State (optional, 2-letter)
  - Primary "Search" button. Disabled until name or phone is present.
- Results section renders a list of candidate cards (name, address, category from `types[0]`, rating with star). Each card has a "Use this business" button.
  - Selecting a card calls the edge function in `details` mode, then runs the existing `confirmBusiness` prefill flow (AI suggestion + `ai-prefill-setup`).
- Empty / no-match state: friendly message + a prominent **"Skip and enter manually"** button that advances to Step 2 with whatever was typed (name/phone) pre-filled. The manual link is also visible at all times under the search form so users never feel stuck.
- Keep the existing "Edit details" affordance after confirmation.

### Copy / UX
- Helper text: "Search by business name. Add city/state or phone to narrow it down."
- Loading and error states reuse existing toast pattern.

## Phase 2 — Google Business Profile OAuth (follow-up, not in this change)

Track as a TODO; surfaced in the UI as a disabled "Connect Google Business Profile (coming soon)" link under the search form. Implementation outline for later:

- Add a Google OAuth app with scopes `https://www.googleapis.com/auth/business.manage` + basic profile.
- New edge functions `gbp-oauth-start` (returns auth URL) and `gbp-oauth-callback` (exchanges code, stores refresh token per `callcapture_clients` row in a new `gbp_refresh_token` column, encrypted).
- New `gbp-import` edge function: lists the user's accounts/locations via Business Profile API and returns verified name, address, phone, hours, website, categories. Frontend renders the locations as the same candidate-card list, so the picker UI is reused.
- Requires Google Cloud project + verification; flag this as a setup step for the operator.

## Technical notes
- No DB migration needed for Phase 1.
- `GOOGLE_PLACES_API_KEY` already exists; Text Search uses the same key.
- Keep response shapes backward-compatible enough that existing `confirmBusiness` logic only needs to consume the `details` response.
