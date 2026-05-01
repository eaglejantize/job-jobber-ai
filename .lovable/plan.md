## CallCapture — Activate Live Demo Number

The live demo number `(904) 892-7004` is now active. Update the app to surface it everywhere, simplify pricing, refine wizard tone, and ensure the "Request Setup Help" CTA is consistent.

### 1. Activate the demo number

**`src/lib/constants.ts`**
- `DEMO_NUMBER = "(904) 892-7004"`
- `DEMO_NUMBER_AVAILABLE = true`
- Add `DEMO_NUMBER_TEL = "+19048927004"` for `tel:` links.

**`src/components/DemoNumberCard.tsx`**
- Use `DEMO_NUMBER_TEL` for the `tel:` href (currently strips formatting, but a hard constant is safer).
- Update subtext to "Tap to call — live now".

### 2. Hero: prominent clickable number

**`src/pages/Index.tsx` — Hero section**
- Under the subheadline, add a bright accent line:
  > "Call the live demo: **(904) 892-7004**" — clickable on mobile via `tel:+19048927004`.
- Primary CTA "Call the Demo" becomes a real `tel:` link (not just a scroll anchor) on mobile; keep the in-page anchor as a secondary route on desktop. Simplest unified solution: button is an `<a href="tel:+19048927004">`. Works on desktop too (no-op or system handler).
- Keep secondary CTA "Get Set Up in 24 Hours" → `/support`.

### 3. "Try It Live" section near the top

Move the existing `#try-it-live` section so it sits **immediately after the hero** (before the "cost of missed calls" stats). Update copy:

- Title: **Try It Live**
- Text: "Call **(904) 892-7004** to hear exactly what your customers experience."
- Subtext: "The AI receptionist answers the call, collects service details, and prepares the lead for the business owner."
- CTAs: **Call Demo** (`tel:+19048927004`) and **Get Set Up in 24 Hours** (`/support`).
- Keep `DemoNumberCard`, `SampleConversation`, and `SampleLeadCard` below.

### 4. Pricing page — single plan only

**`src/pages/Pricing.tsx`** is already a single plan. Tighten copy to match the brief exactly:
- Plan: **CallCapture Pro** — $197/month + $99 setup
- Features list (replace current):
  - 24/7 AI call answering
  - Lead capture
  - SMS lead notifications
  - Call forwarding
  - Custom business script
  - After-hours handling
- Add tagline above the card: **"Pays for itself with 1–2 captured jobs."**
- Keep "Cancel anytime. No contracts." under the CTA.
- Keep `RequestSetupBanner` at bottom.
- Mirror the same simplified feature list inside the homepage pricing block (`src/pages/Index.tsx`) for consistency.

### 5. Setup wizard — tone polish

**`src/pages/Setup.tsx`**
- Step labels array: rename `"Receptionist Behavior"` → `"Receptionist Behavior"` (keep), but ensure all hero/header copy says "Set up your AI receptionist" (already close — confirm wording).
- Final step header already says "Your AI Receptionist Is Ready" ✓.
- Final step buttons: keep **Copy Instructions** and **Request Setup Help** as the two primary actions (already present). Move the "Save to my dashboard" button below them as a secondary action (already secondary — keep).
- Sweep any remaining "configure assistant" phrasing → "set up your AI receptionist". (Quick rg confirms none present, but verify during edit.)

### 6. Dashboard — keep simple

**`src/pages/Dashboard.tsx`** already shows: Setup Status, Assistant Instructions, Vapi connect block, Request Setup banner. Adjustments:
- Replace the "Connect to Vapi" side card with a **Demo Number** card (uses `DemoNumberCard` content — phone number prominent, tappable). Move the Vapi instructions into a collapsible `<details>` below the assistant instructions so the dashboard stays uncluttered.
- No CRM, invoices, job boards, or lead lists. Confirmed not present.

### 7. "Want us to set this up?" CTA everywhere

The `RequestSetupBanner` already appears on Home, Pricing, Setup, Dashboard, Support. Update the default banner copy to the exact line:

> "Want us to set this up for you? We'll do it in 24 hours."
> Button: **Request Setup Help**

Keep `variant="compact"` for sidebar/inline use.

### 8. Theme

Already dark navy + bright green. No design system changes.

---

### Files to edit

- `src/lib/constants.ts` — number, availability flag, tel constant
- `src/components/DemoNumberCard.tsx` — tel link + "live now" subtext
- `src/components/RequestSetupBanner.tsx` — exact CTA copy
- `src/pages/Index.tsx` — hero number line, hero CTA → tel:, reorder Try-It-Live above stats, simplified pricing features
- `src/pages/Pricing.tsx` — "Pays for itself…" tagline, exact feature list
- `src/pages/Setup.tsx` — verify wording sweep
- `src/pages/Dashboard.tsx` — swap Vapi card for Demo Number card; collapse Vapi instructions

### Out of scope

- No new database tables or auth changes.
- No new routes.
- No CRM/lead management features.