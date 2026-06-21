# Business Lookup Onboarding

Cut receptionist setup from 10+ minutes to under 2 by letting the owner type their business phone number, looking up the business automatically, generating a greeting + intake questions with AI, and saving in one screen.

## User flow

```text
/onboarding
  ┌──────────────────────────────────────────────┐
  │ 1. Enter business phone (E.164)              │
  │    [ Look up my business ]                   │
  └──────────────────────────────────────────────┘
                ↓ (≈3–6s spinner)
  ┌──────────────────────────────────────────────┐
  │ 2. Pre-filled, editable card:                │
  │      • Business name                         │
  │      • Address                               │
  │      • Website                               │
  │      • Business hours                        │
  │      • Industry (dropdown)                   │
  │      • Suggested greeting (textarea)         │
  │      • Suggested intake questions (chips)    │
  │    [ Save & continue ]   [ Use full wizard ] │
  └──────────────────────────────────────────────┘
                ↓
            /dashboard
```

If lookup fails (unlisted number, new business), the same screen reveals empty editable fields plus an "Industry" dropdown. Once the user picks an industry, the AI still generates greeting + intake questions so they get the fast path either way.

A "Use full wizard" link on the same page hands off to `/setup` with whatever has been filled so far (saved into `localStorage` under `callcapture.wizard`, the existing key).

## What gets built

### 1. New edge function `supabase/functions/business-lookup/index.ts`
- POST `{ phone: string }` (E.164, validated with Zod).
- Step A — Google Places: `GET https://places.googleapis.com/v1/places:searchText` with `textQuery = phone`, `X-Goog-FieldMask = places.displayName,places.formattedAddress,places.websiteUri,places.regularOpeningHours,places.types,places.primaryType,places.nationalPhoneNumber`. Take the first result.
- Step B — Industry classification + greeting + intake via Lovable AI (`google/gemini-3-flash-preview`) using AI SDK `generateText` with `Output.object`. Schema:
  ```ts
  { industry: enum(INDUSTRIES), greeting: string, intakeQuestions: string[5..7] }
  ```
  Prompt includes the business name, address, Google `types`, and our `INDUSTRIES` list so the model picks one of our existing labels.
- Returns `{ found: boolean, business: {...} | null, suggestion: {...} }`. When Places returns nothing, `found = false`, `business = null`, and `suggestion` is omitted (UI will request industry first, then call a second small endpoint — see #2).
- `verify_jwt = false`; CORS; uses `GOOGLE_PLACES_API_KEY` + existing `LOVABLE_API_KEY`.

### 2. New edge function `supabase/functions/suggest-greeting/index.ts`
- POST `{ businessName, industry }` → same AI schema minus `industry`. Used for the manual-fallback path and for "regenerate" buttons on the onboarding screen.
- `verify_jwt = false`; CORS; `LOVABLE_API_KEY` only.

### 3. New page `src/pages/Onboarding.tsx`
- Route: `/onboarding` (added to `src/App.tsx`, wrapped in `RequireAuth`).
- Single-screen flow described above. Uses shadcn `Input`, `Button`, `Textarea`, `Select` (Industry), `Badge` (intake chips with × to remove + "Add" input), and a `Skeleton` while lookup runs.
- On Save:
  - Upsert `callcapture_clients` row (existing table) with business_name, industry, address, website, business_hours, greeting, intake_questions, business_phone, owner email/name from auth.
  - Also writes the same payload into `localStorage` `callcapture.wizard` so `/setup` stays in sync if the user opens it later.
  - Navigates to `/dashboard`.
- "Use full wizard" button: save partial state to `localStorage` and navigate to `/setup`.

### 4. Entry-point wiring
- After signup/login, redirect first-time users (no `callcapture_clients` row, or row missing `business_name`) to `/onboarding` instead of `/setup`. Done in `RequireAuth` / `Login.tsx` post-auth redirect.
- Existing `/setup` stays untouched as the fallback wizard.

### 5. Secrets
- New: `GOOGLE_PLACES_API_KEY` (requested via `add_secret` after approval; instructions: Google Cloud Console → enable Places API (New) → create API key restricted to Places API).
- Reuses: `LOVABLE_API_KEY`.

## Out of scope
- No changes to intake extraction, SMS alerts, lead creation, call routing, Vapi assistant provisioning, or Stripe checkout. (Vapi assistant gets created/updated via the existing `update-vapi-agent` flow when the user later launches from the wizard or settings — not from `/onboarding`.)
- No new DB columns; `callcapture_clients` already has `business_name`, `industry`, `address`, `website`, `business_hours`, `greeting`, `intake_questions`, `business_phone`.
- No phone number provisioning on `/onboarding` (still happens in `/setup`).

## Technical notes
- Phone normalization: client + server both coerce to E.164 (`+1` default for US-looking 10-digit input).
- Places "Text Search (New)" works with phone-number queries and returns a single best match; if zero results, fall back to `places:searchNearby` is **not** needed — we just trigger manual mode.
- AI call uses the gateway helper pattern from `ai-sdk-lovable-gateway` knowledge (Deno `npm:` imports).
- Industry enum is built from `src/lib/industries.ts` and shared with the edge function via a copy in `supabase/functions/_shared/industries.ts` to keep enums in sync.