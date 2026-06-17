## Goal

Make this app look like the **Vektuor Reception Hub** reference project — clean, premium, navy + electric-blue, calm. Keep every existing backend integration (Supabase tables, Vapi, Twilio, Stripe edge functions, auth, wizard schema, routing) working unchanged.

This is a **UI/design port**, not a logic rewrite.

---

## 1. Design system foundation

Replace the current visual tokens with Vektuor Reception Hub's tokens so every shadcn component inherits the new look automatically.

- **`src/index.css`** — replace `:root` HSL tokens with reference's navy/slate/electric-blue palette, add `--brand`, `--brand-soft`, `--navy`, `--navy-deep`, `--slate-ink`, `--success`, three shadow tiers, and `--gradient-hero` / `--gradient-navy` / `--gradient-brand`. Add utility classes: `.bg-gradient-hero`, `.bg-gradient-navy`, `.bg-gradient-brand`, `.shadow-soft`, `.shadow-elevated`, `.shadow-glow`, `.text-balance`, `.glow-brand`, `.feed-mask`.
- **`tailwind.config.ts`** — extend colors with `brand` (+ `soft`), `navy` (+ `deep`), `ink`, `success`; bump `--radius` to `0.875rem`; add `2xl`/`3xl` radius steps; register `fade-up`, `soft-pulse`, `float`, `shimmer`, `slide-in-up` keyframes/animations; keep Inter as default sans.
- **`index.html`** — load Inter from Google Fonts; keep existing title/meta and `trycallcapture.com` canonical.

## 2. Logo + assets

- Copy reference's `public/favicon.ico` over the current favicon.
- Keep the existing `src/assets/vektuor-logo.png` (already on-brand: blue circle + phone icon + "Vektuor" wordmark). No new logo generation.

## 3. Landing page rebuild (`src/pages/Index.tsx`)

Mirror the reference's section architecture, with copy adapted to keep already-approved hero text ("24/7 AI Receptionist for Service Businesses" / "Vektuor answers every call…") and the "Built for service businesses of every size" line. Each section becomes its own component under `src/components/landing/`:

- `Navbar.tsx` — sticky, frosted, logo left + Features / How it works / Live demo / Pricing / FAQ anchors + Sign in / Start Free Trial CTA (links to `/auth` and `/setup`).
- `Hero.tsx` — soft hero gradient bg, "Now answering for service businesses of every size" pill, balanced H1, sub-copy, primary + secondary CTA, micro-trust line, and the embedded "vektuor.app / inbox" mock card (static visual only, no real data).
- `SocialProof.tsx` — single tagline "Built for service businesses of every size" (no fake company logos/stats).
- `Problem.tsx` — three pain-point cards (missed calls, after-hours, lead leakage) — generic, no fake numbers.
- `HowItWorks.tsx` — 3 steps: connect number → AI answers → lead lands in inbox.
- `Features.tsx` — feature grid using reference layout (icon + title + 1-liner).
- `MobileApp.tsx` — phone mockup with inbox screen.
- `LiveDemo.tsx` — wraps existing `<CallDemoButton />` / `<DemoNumberCard />` so the real demo SMS edge function stays wired.
- `ActivityFeed.tsx` — animated faux ticker (purely decorative, generic events, no fake company names).
- `Pricing.tsx` (landing variant) — single $249/mo + $99 setup card, CTA → `/auth` then `/setup`. Mirrors reference pricing visual.
- `FAQ.tsx` — accordion of 6 generic FAQs.
- `FinalCTA.tsx` — navy gradient panel, headline + CTA.
- `Footer.tsx` — replaces current `SiteFooter`; same nav, `support@vektuor.com`, copyright Vektuor.

Old marketing components (`SiteNav`, `SiteFooter`, current inline hero blocks) get deleted or reduced to re-exports of the new landing components.

## 4. Authenticated app shell

Reskin only — every route, query, mutation, and Supabase call stays identical.

- **`src/components/AppNav.tsx`** → restyle to match reference's `Topbar` (white surface, subtle border, brand-color avatar, dense type). Keep current links (Dashboard, Leads, Settings) and `useAuth` sign-out.
- **`src/pages/Dashboard.tsx`** — rebuild visual layout with reference's overview cards (stat tiles using `shadow-soft`, brand accents) but keep all existing data hooks: `callcapture_businesses`, `callcapture_assistant_configs`, recent-leads query, phone status. No new tables, no schema changes.
- **`src/pages/LeadInbox.tsx`** — apply reference inbox styling (two-pane look, status pills, intake card). Same query, same columns.
- **`src/pages/Settings.tsx`** — group sections into reference-style cards.
- **`src/pages/Setup.tsx`** — keep the existing 6-step wizard logic and `wizardSchema`. Restyle step shell, progress bar, and field cards to match reference's onboarding visuals. Industry dropdown stays as already wired.
- **`src/pages/Auth.tsx` / `Confirm.tsx` / `ResetPassword.tsx`** — center card on `bg-gradient-hero`, brand button, Vektuor logo at top.
- **`src/pages/Pricing.tsx`, `Demo.tsx`, `Support.tsx`, `Start.tsx`, `NotFound.tsx`** — restyle using new tokens; logic untouched.

## 5. Shared component restyles

- `PhoneNumberPicker`, `SampleConversation`, `SampleLeadCard`, `RequestSetupBanner`, `DemoNumberCard`, `VoicePicker`, `CallDemoButton` — restyle with new tokens/shadows/radii. No behavior changes.
- shadcn `ui/*` primitives left untouched; they inherit via tokens.

## 6. Explicitly out of scope

- No edits to `supabase/functions/*`, `supabase/config.toml`, `src/integrations/supabase/*`, `.env`, Stripe/Twilio/Vapi keys, `wizardSchema.ts` field shape, or DB schema.
- No copying of Vektuor Reception Hub's auth/dashboard *logic* — only its visual structure. Its routes (`/onboarding`, `/checkout`, `/dashboard/*` subpages) are NOT introduced; we keep current routes.
- No new fake stats, no fake company names (Northside, BrightWire, etc.).
- Canonical URL stays `trycallcapture.com`.

## 7. Verification

- `bun run build` green.
- Visual smoke check via `browser--view_preview` on `/`, `/auth`, `/setup`, `/dashboard`, `/leads`, `/pricing`, `/demo`.
- `rg -i "callcapture|northside|brightwire|rapidflow|summit roofing|1,200\+|250,000\+|98%"` returns only backend/table-name matches.
- Confirm demo SMS button still calls `send-demo-sms` edge function (network tab).

## Technical notes

- Path alias `@/` unchanged. React Router v6 unchanged. TanStack Query unchanged.
- New files live under `src/components/landing/`. Existing `SiteNav`/`SiteFooter` deleted after `Index.tsx` is migrated.
- All restyles use semantic tokens (`bg-background`, `text-foreground`, `bg-brand`, `text-ink`, `shadow-soft`, etc.) — no hardcoded hex / `text-white` / `bg-black`.
