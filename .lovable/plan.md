
# CallCapture — Revised Plan (Conversion-First)

Reposition CallCapture from a configurator into a **done-for-you revenue tool**. Every page pushes toward two actions: **Call the Demo** or **Request Setup Help**. Setup wizard stays, but framed as "we'll do it for you if you want."

---

## Design

Dark navy theme, bright green CTAs (oversized, obvious), white/light-gray text. Money-focused, plain-English copy throughout. No "AI platform" or technical jargon.

Color tokens (HSL, in `index.css`): deep navy background, lighter navy surfaces, bright green accent, soft green glow on primary buttons.

---

## Pages

### 1. `/` — Landing (the workhorse)

**Sticky nav:** Home · Demo · Pricing · Setup · Dashboard · Support — plus green **Get Set Up in 24 Hours** button.

**Hero**
- H1: "Stop Missing Service Calls"
- Sub: "CallCapture answers every call, captures customer details, and turns missed calls into booked jobs — automatically."
- Primary CTA (green, large): **Call the Demo** → scrolls to demo section
- Secondary CTA: **Get Set Up in 24 Hours** → `/support`
- Prominent demo number panel: large monospaced number placeholder + "Demo number coming soon" badge + tap-to-copy

**Try It Live (demo section, on landing)**
- Big phone-number card: "Call this number to hear exactly what your customers will experience."
- Sample transcript (chat bubbles, customer ↔ receptionist)
- "What you receive after a call" — sample lead card (Sarah Johnson, fridge repair, urgency High, summary)

**The Cost of Missed Calls** (short trust band)
- 3 stat cards reinforcing money lost per missed call

**Who It's For**
- Industry chips: Appliance Repair, HVAC, Plumbing, Electrical, Locksmiths, Med Spas, Law Firms, Local Service

**How It Works** — 4 plain steps (forward your number → we set up your receptionist → calls get answered 24/7 → leads sent to your phone)

**Pricing** (single plan, see below)

**Final CTA band:** "Want us to set this up for you? We'll do it in 24 hours." + green **Request Setup Help** button.

Footer.

### 2. `/demo`
Standalone version of the Try It Live section with more breathing room — same demo number card, transcript, lead card preview, and a closing **Get Set Up in 24 Hours** CTA. No technical explanation.

### 3. `/pricing` — One plan only
Single centered card: **CallCapture Pro — $197/month** + **$99 one-time setup**.
Features bulleted exactly per spec. Tagline: *"Pays for itself with 1–2 captured jobs."* Footnote: *"Cancel anytime. No contracts."* CTA: **Get Set Up in 24 Hours**.

Below the card, a softer secondary block: "Prefer to set it up yourself? Use our free setup wizard." → `/setup`.

### 4. `/setup` — Wizard, repositioned
Header copy: **"Let's set up your AI receptionist"** with progress indicator "Step X of 6".

On every step, a persistent right-side (or bottom on mobile) callout:
> "Don't want to do this yourself? We'll set it up for you in 24 hours." → **Request Setup Help**

Steps unchanged in content (Business Info → Receptionist Behavior → Intake Questions → Call Handling → Notifications → Review), but copy softened and de-jargoned.

**Final step (Review):**
- Title: **"Your AI Receptionist Is Ready"**
- Show generated prompt (template-based, deterministic) in a clean copy block
- Helper line: "Copy this into your Vapi assistant — or let us set it up for you."
- Two buttons side-by-side:
  - **Copy Instructions** (green)
  - **Request Setup Help** (green outline) → `/support` prefilled
- Saves config to Lovable Cloud if signed in

### 5. `/dashboard` — Simplified (auth-gated)
Four sections only:
1. **Setup Status** — single badge: Not Started / In Progress / Ready
2. **Your Assistant Instructions** — shows saved generated prompt with copy button (or empty state linking to `/setup`)
3. **Demo Instructions** — short numbered checklist for connecting to Vapi
4. **Support / Request Setup** — green button to `/support`

No leads list. No CRM. No "configuration" panel.

### 6. `/support`
Form: name, business name, email, phone, request type (Setup my assistant / Connect my phone number / Build my script / Test my demo / Other), message. Headline: **"We'll set up your AI receptionist in 24 hours."** Submits to Lovable Cloud, toast confirmation.

### 7. `/auth`
Email + password (Lovable Cloud, auto-confirm on). Required only for `/dashboard` and saving wizard progress; the wizard works unauthenticated using local state and prompts to sign in at the final save.

### 8. `/*` NotFound — restyled to dark theme.

---

## Persistent Conversion Lever

A reusable `<RequestSetupBanner />` placed on:
- Landing (final band)
- Demo page (footer)
- Every wizard step (sidebar/bottom)
- Pricing page (under the card)
- Dashboard (its own section)

Single message: *"Want us to set this up for you? We'll do it in 24 hours."* + green **Request Setup Help** button.

---

## Backend (Lovable Cloud)

Tables (RLS, owner-scoped):
- **callcapture_businesses** — id, user_id, business_name, industry, phone, email, service_area, business_hours, created_at
- **callcapture_assistant_configs** — id, business_id, assistant_name, greeting, tone, after_hours_enabled, transfer_enabled, transfer_phone, intake_questions jsonb, call_rules jsonb, notification_settings jsonb, generated_prompt, created_at, updated_at
- **callcapture_support_requests** — id, name, business_name, email, phone, request_type, message, created_at (public insert; user can read their own)

Setup status on dashboard derived from presence/completeness of these rows.

---

## Tone rules baked into copy
- Talk about **missed calls and money**, not "AI" or "configuration"
- Short sentences, action verbs
- Every page ends with a CTA toward demo or setup help
- No feature dumps; benefits only

---

## Out of scope
- Real telephony / Vapi calls
- Real lead inbox / CRM
- Multi-tier pricing
- Stripe billing
