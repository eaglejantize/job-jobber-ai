# Rebrand to Vektuor

Frontend-only rebrand. No backend, edge functions, table names, Stripe, or Supabase config touched. Canonical domain stays `trycallcapture.com` in meta tags.

## 1. Logo

Generate `src/assets/vektuor-logo.png` (transparent PNG): blue circle with a white phone icon, "Vektuor" wordmark beside it. Use in `SiteNav`, `AppNav`, and `SiteFooter` in place of any current logo/text mark.

## 2. Brand text replacements

Replace user-facing "CallCapture" / "TryCallCapture" → "Vektuor" across:
- `index.html` — `<title>`, meta description, OG/Twitter tags (keep canonical URL `trycallcapture.com`)
- `src/components/SiteNav.tsx`, `AppNav.tsx`, `SiteFooter.tsx`
- `src/pages/Index.tsx`, `Pricing.tsx`, `Demo.tsx`, `Support.tsx`, `Auth.tsx`, `Setup.tsx`, `Dashboard.tsx`, `LeadInbox.tsx`, `Settings.tsx`, `Start.tsx`, `Confirm.tsx`, `ResetPassword.tsx`, `NotFound.tsx`
- `src/components/PhoneNumberPicker.tsx`, `SampleConversation.tsx`, `SampleLeadCard.tsx`, `RequestSetupBanner.tsx`, `DemoNumberCard.tsx`
- Support email → `support@vektuor.com`

## 3. Hero section (`src/pages/Index.tsx`)

- H1 → `24/7 AI Receptionist for Service Businesses`
- Subtext → `Vektuor answers every call, captures customer details, and notifies you instantly — so you never miss a job.`
- Remove placeholder stats: `1,200+ home-service teams`, `250,000+ calls answered`, `98% response rate`.
- Remove fake company names: Northside HVAC, BrightWire Electric, RapidFlow Plumbing, Summit Roofing.
- Replace social proof section with a single centered line: **"Built for service businesses of every size."**
- De-restrict "home-service" copy → "service businesses" throughout the page.

## 4. Industry dropdown (`src/lib/constants.ts`)

Replace `INDUSTRIES` with:
`Appliance Repair, HVAC, Plumbing, Electrical, Law Firm, Med Spa, General Contractor, Other`

This automatically updates the Setup wizard dropdown. Adjust `generatePrompt.ts` / `receptionistScript.ts` industry routing only if existing string matches break (med spa key preserved).

## 5. Receptionist script (`src/lib/receptionistScript.ts`)

Replace "CallCapture" → "Vektuor" in prompt constants and prompt-builder functions so the AI introduces itself as Vektuor's receptionist.

## 6. Out of scope

- Backend table names (`callcapture_*`), edge functions, Supabase client, Stripe.
- `index.html` canonical URL / `og:url` — stays `trycallcapture.com`.
- Favicon (unchanged unless requested).

## 7. Verification

- `rg -i "callcapture|trycallcapture|northside|brightwire|rapidflow|summit roofing|1,200\+|250,000|98%"` → should only return backend files (`callcapture_*` tables, edge functions, types).
- Visual check `/`, `/setup`, `/pricing`, `/dashboard` in preview.
- `bun run build` green.
