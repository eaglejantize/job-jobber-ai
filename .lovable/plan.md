# CallCapture Homepage Conversion Refinement

## Goal
Make the homepage feel like a money-making system. Push every visitor to call the demo, then to "Get Set Up in 24 Hours."

---

## 1. Hero (`src/pages/Index.tsx`)

Keep 2-column layout (copy left, demo card right). Update content:

**Left column:**
- Eyebrow: keep
- H1: `Stop Missing Service Calls — Even After Hours`
- Subhead: `Answer every call. Capture details. Get booked jobs.`
- Urgency line (primary green, bold): `Every missed call is a lost job.`
- **NEW money hook** (muted, slightly larger): `Most service calls are worth $150–$500. Missing just one per day costs you thousands per month.`
- CTAs:
  - Primary (large green): `Call the Demo` → `tel:+19048927004`
  - Secondary (outline): `Get Set Up in 24 Hours` → `/support`
- Under buttons (small): `Takes 30 seconds to try • No signup. No setup. Just call.`
- Audience line (muted xs): `Built for appliance repair, HVAC, plumbing, electrical, and local service businesses.`

**Right column:** `DemoNumberCard` (updated below)

**Proof strip (under hero, already exists):** keep "No contracts • Live in 24 hours • Pays for itself with 1–2 jobs"

---

## 2. Demo Number Card (`src/components/DemoNumberCard.tsx`)

Update copy:
- Badge: `LIVE — CALL NOW` (keep pulse)
- Number: `(904) 892-7004` (large, click-to-call)
- Subtext line 1: `Takes 30 seconds. No signup required.`
- Subtext line 2 (new, italic muted): `Call now and pretend you're a customer — it takes 30 seconds.`
- Subtext line 3: `Hear exactly what your customers experience.`
- Buttons:
  - Primary green full-width: `Call the Demo` (`tel:` link — works on desktop too, mobile dials)
  - Secondary smaller outline: `Copy Number` (existing copy-to-clipboard)

Behavior is already correct: `tel:` href works on mobile to dial; on desktop the Copy Number button provides the fallback. No JS changes needed beyond copy.

---

## 3. Remove Duplication — Replace "Try It Live" Section

In `Index.tsx`, **delete the entire `#try-it-live` section** (the second `DemoNumberCard` + `SampleConversation` block).

Replace with a new section titled:

**`What You Get From Every Missed Call`**

Layout (centered, max-w-4xl):
- Section heading + subhead: `A real lead — name, phone, address, and the job — delivered to your phone the moment the call ends.`
- Two-column: left = `SampleConversation`, right = `SampleLeadCard` (already has all required fields: Name, Phone, Address, Service Needed, Urgency, Call Summary). Add an "Issue" row to `SampleLeadCard` if not present — it currently uses "Service Needed" which covers both; leave as-is to avoid redundancy.
- Below the grid, single CTA: `Get Set Up in 24 Hours` (primary green).

This removes the duplicate demo number lower on the page.

---

## 4. How It Works
Already matches the requested 4 steps. No change.

---

## 5. Pricing Block on Index
Already correct ($197/mo + $99 setup, feature list, "Pays for itself…", "Cancel anytime. No contracts.", CTA `Get Set Up in 24 Hours`). No change.

---

## 6. Setup Page (`src/pages/Setup.tsx`) — Tone Pass

- Final step label: change `"Your AI Receptionist"` → `"Your AI Receptionist Is Ready"` in `STEPS` array.
- On the final step screen, ensure the two visible buttons are: `Copy Instructions` and `Request Setup Help` (link to `/support`). Remove or de-emphasize any other CTAs on that step.
- Anywhere copy says "Configure assistant" / "Configure your assistant", change to `Set up your AI receptionist`.

(No schema or data changes.)

---

## 7. Global Support CTA
`RequestSetupBanner` already renders the exact line "Want us to set this up for you? / We'll do it in 24 hours." with a `Request Setup Help` button. Verify it appears on:
- `/` (Index) — present ✅
- `/pricing` — present ✅
- `/setup` — confirm it's rendered (add at bottom if missing)
- `/dashboard` — confirm it's rendered (add compact variant if missing)

---

## 8. Design
No theme changes. Dark navy background, bright green CTAs already in use via `bg-cta` + `shadow-glow`. Keep tight spacing — no extra padding added.

---

## Files to Edit
- `src/pages/Index.tsx` — add money hook + reassurance line; replace "Try It Live" section with "What You Get From Every Missed Call"
- `src/components/DemoNumberCard.tsx` — add the "pretend you're a customer" line; rename secondary button label to `Copy Number`
- `src/pages/Setup.tsx` — final step rename + CTA cleanup; "Configure assistant" → "Set up your AI receptionist"
- (Verify only) `src/pages/Dashboard.tsx`, `src/pages/Setup.tsx` for `RequestSetupBanner` presence; add if missing

## Out of Scope
- No new routes, no schema/migrations, no auth changes, no new dependencies.
