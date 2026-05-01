## CallCapture — Tighten hero, make the demo the star

Most of this round is already done from the prior pass: the live number `(904) 892-7004` is wired with `tel:` links, pricing is a single Pro plan with the exact feature list and "Pays for itself…" tagline, the setup wizard uses "AI receptionist" wording with "Your AI Receptionist Is Ready" + Copy Instructions / Request Setup Help, the dashboard is minimal (status + instructions + demo number + setup help), the support CTA banner appears globally, and the dark-navy + green-CTA theme is in place.

The remaining changes sharpen the hero, make the demo block visually dominant, and add desktop click-to-copy.

### 1. Hero copy (`src/pages/Index.tsx`)

- Headline: **"Stop Missing Service Calls — Even After Hours"** (two lines on desktop, single block on mobile).
- Trust line directly under the headline, in muted/accent color: **"Never miss another $150–$500 job because you missed a call."**
- Subheadline: **"CallCapture answers every call, collects customer details, and sends you a ready-to-book lead instantly."**
- Keep the "Call the live demo: (904) 892-7004" line (clickable `tel:` link).
- CTAs unchanged in order — primary **Call the Demo** (`tel:+19048927004`, bright green, slightly larger), secondary **Get Set Up in 24 Hours** (`/support`).
- New microcopy under CTAs: **"Takes 30 seconds to try • No signup required"**.

### 2. Demo number card — make it the star (`src/components/DemoNumberCard.tsx`)

- Badge above the number: **"LIVE — CALL NOW"** (solid green pill, not the current dotted "Live Demo — Live Now" label). Remove any "coming soon" branch entirely since the number is live.
- Number stays large and tappable; bump size on the hero instance.
- Subtext under the number: **"Takes 30 seconds to experience. No signup required."**
- Add a **Copy number** button next to the call action for desktop users — uses `navigator.clipboard.writeText(DEMO_NUMBER_TEL)` and shows a toast "Number copied".
- On mobile the primary action remains a `tel:` tap on the number/CTA.

### 3. Try It Live section (`src/pages/Index.tsx`)

- Already positioned right after the hero. Tighten copy to match the brief's emphasis: keep the title, the "Call (904) 892-7004…" line, and the dual CTAs (Call Demo / Get Set Up in 24 Hours).
- Add the same "Takes 30 seconds to try" microcopy under the buttons.

### 4. How It Works (`src/pages/Index.tsx`)

Replace the four step strings with the exact wording from the brief:
1. Forward your number to CallCapture
2. We set up your AI receptionist
3. Calls get answered 24/7 — even after hours
4. Get new leads sent to your phone instantly

### 5. Already in place — no changes needed

- Pricing (homepage block + `/pricing`): single CallCapture Pro plan, $197/mo + $99 setup, exact feature list, "Pays for itself with 1–2 captured jobs", "Cancel anytime. No contracts.", CTA "Get Set Up in 24 Hours".
- Setup wizard (`src/pages/Setup.tsx`): all "AI receptionist" wording; final step "Your AI Receptionist Is Ready" with Copy Instructions + Request Setup Help.
- Dashboard (`src/pages/Dashboard.tsx`): Setup Status, Assistant Instructions, Demo Number card, Request Setup banner — no CRM/job tracking.
- `RequestSetupBanner`: exact copy "Want us to set this up for you? We'll do it in 24 hours." + Request Setup Help button, mounted on home/pricing/setup/dashboard/support.
- Theme: dark navy + bright green CTAs.

### Files to edit

- `src/pages/Index.tsx` — hero headline, trust line, subheadline, CTA microcopy, How It Works step text.
- `src/components/DemoNumberCard.tsx` — solid "LIVE — CALL NOW" badge, 30-second subtext, desktop Copy-number button with toast.

### Out of scope

- No new pages, routes, tables, or auth changes.
- No CRM, job board, or lead-management features.