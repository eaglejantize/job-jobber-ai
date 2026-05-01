# Final Conversion Pass — CallCapture

Most of this brief is already live. This pass only closes small gaps. No layout changes, no new components.

## 1. Hero (`src/pages/Index.tsx`)
Already matches: headline, subheadline, $150–$500 line, $6K–$15K line, CTAs with microcopy. **No change.**

## 2. Demo Card (`src/components/DemoNumberCard.tsx`)
Already matches the brief (badge, number, "act like a real customer", "30 seconds", "No signup. No setup. No commitment.", Call/Copy buttons). **No change.**

## 3. Stats section (`src/pages/Index.tsx`)
Currently shows three stats. Brief asks to keep the 62% stat and add "Average service call value: $150–$500".

Replace the three-stat grid with two cards (keeps spacing tidy):
- 62% — of calls to small businesses go unanswered
- $150–$500 — average value of a single service call

Switch grid to `sm:grid-cols-2 max-w-2xl mx-auto`.

## 4. "What You Get" section (`src/pages/Index.tsx`)
Rename section heading to **"Try It Live"** with body: *"Call (904) 892-7004 to hear exactly what your customers experience."* and small line *"No signup. Takes 30 seconds."*

Replace the two small column labels:
- Left ("Sample conversation") → **"This is exactly how your calls are handled"**
- Right ("Lead sent to your phone") → **"Sent to your phone instantly"**

Keep the `SampleConversation` + `SampleLeadCard` grid and the "Get Set Up in 24 Hours" CTA below it.

## 5. Sample Lead Card (`src/components/SampleLeadCard.tsx`)
Change the top-right "Sample" tag text to **"Just now"** so it reads as a real lead, not a demo. Header label "New Lead Captured" stays.

Rename the "Service Needed" row label to just **"Service"** to match the brief.

## 6. "Done For You" section (`src/pages/Index.tsx`)
Currently titled "We'll Set This Up For You" with 3 bullets. Update to match brief:
- Keep title.
- Body: *"Don't want to deal with setup or tech? We handle everything:"*
- Bullets:
  - Your call script
  - Your AI receptionist
  - Your call routing
  - Your SMS alerts
- Closer line: *"You just forward your number and start getting jobs."*
- Keep CTA "Request Setup Help" + add subtext under button: *"Live in 24 hours."*

## 7. Pricing, How It Works, Final CTA, Pricing page
All already match the brief. **No change.**

## 8. Tone scan
Ripgrep confirms no remaining "AI assistant", "platform", or "system" copy in the affected files. **No change.**

---

## Files to Edit
- `src/pages/Index.tsx` — stats grid (2 cards), Try It Live heading + column labels, Done For You bullets/copy/subtext
- `src/components/SampleLeadCard.tsx` — "Sample" → "Just now"; "Service Needed" → "Service"

## Out of Scope
No new routes, components, dependencies, schema, or layout changes.
