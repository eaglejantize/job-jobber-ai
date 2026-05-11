# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CallCapture** is an AI-powered call answering and lead capture SaaS platform for service businesses (HVAC, Plumbing, Electrical, Med Spas, Law Firms, etc.). It uses an AI receptionist (via Vapi) to answer calls, capture lead info, and notify business owners. Pricing is $249/month + $99 setup fee.

## Commands

```bash
npm run dev          # Start dev server (Vite on port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
npm run preview      # Preview production build
```

Both npm and Bun are supported (dual lockfiles). Supabase Edge Functions run on Deno.

## Architecture

### Frontend (`src/`)

**Pages** (`src/pages/`) — React Router v6 routes:
- `Index.tsx` — Public landing/marketing page
- `Setup.tsx` — 6-step wizard to configure the AI receptionist
- `Dashboard.tsx` — Authenticated user home: stats, recent leads, phone status
- `LeadInbox.tsx` — All captured leads
- `Pricing.tsx` — Subscription pricing page
- `Demo.tsx` — Demo call experience
- `Auth.tsx` / `Login.tsx` / `ResetPassword.tsx` — Auth flows

**Components** (`src/components/`):
- `ui/` — shadcn/ui components (Radix UI). Do not edit these manually.
- `route-guards.tsx` — `RequireAuth` and `RedirectIfAuthed` HOCs that protect routes
- Other custom components: `Layout`, `SiteNav`, `AppNav`, `PhoneNumberPicker`, `DemoNumberCard`

**Key library files** (`src/lib/`):
- `wizardSchema.ts` — Zod schema for all 40+ fields in the setup wizard
- `generatePrompt.ts` — Dynamically builds the AI system prompt from wizard config
- `receptionistScript.ts` — Defines the receptionist's goals, intake fields, call flow steps, and opening/closing lines
- `constants.ts` — Industries, tones, intake question defaults, transfer triggers, fallback actions, demo numbers
- `voices.ts` — Voice persona definitions with preview URLs

**State & Data:**
- Auth state: `src/hooks/useAuth.ts` (Supabase session)
- Server state: TanStack React Query v5
- Forms: React Hook Form + Zod (`wizardSchema.ts`)
- Path alias: `@/` → `src/`
- TypeScript is configured with relaxed rules (`noImplicitAny: false`, `strictNullChecks: false`)

### Backend (Supabase)

**Database tables** (all RLS-protected by `auth.uid()`):
- `callcapture_businesses` — Business profile (name, industry, phone, hours, service area)
- `callcapture_assistant_configs` — AI receptionist config per business (greeting, tone, questions, generated prompt)
- `callcapture_support_requests` — Support tickets (public insert)

**Edge Functions** (`supabase/functions/`) — Deno TypeScript serverless:
- `send-demo-sms/` — Triggers a demo call via Vapi + Twilio
- `search-twilio-numbers/` — Queries available Twilio phone numbers
- `provision-twilio-number/` — Activates a Twilio number for a business
- `create-checkout/` — Creates a Stripe checkout session
- `stripe-webhook/` — Handles Stripe subscription lifecycle events

**Supabase client:** `src/integrations/supabase/client.ts` (uses `localStorage` session persistence). Generated types are in `src/integrations/supabase/types.ts` — do not edit manually.

### External Integrations

| Service | Purpose |
|---------|---------|
| Vapi | AI voice agent for answering calls |
| Twilio | Phone number provisioning and call routing |
| Stripe | Subscription billing ($249/mo + $99 setup) |
| Supabase | Auth, database, and edge functions |
| Lovable | Component tagging via `lovable-tagger` Vite plugin |

### Setup Wizard Flow

The 6-step wizard (`Setup.tsx`) collects config validated by `wizardSchema.ts`:
1. Business Info → 2. Phone Setup → 3. Call Handling → 4. AI Receptionist → 5. Voice & Greeting → 6. Review & Launch

On launch, it saves to `callcapture_businesses` + `callcapture_assistant_configs` and redirects to Stripe checkout.

### Auth & Routing

- Public routes: `/`, `/demo`, `/pricing`, `/support`, `/login`, `/reset-password`
- Protected routes: `/setup`, `/settings`, `/dashboard`, `/leads`
- Guards live in `src/components/route-guards.tsx`
