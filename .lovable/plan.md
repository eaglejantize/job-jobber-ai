## Root cause

In `src/index.css`, the `.dark` theme overrides redefine the brand tokens:

```css
--navy: 210 20% 96%;      /* near-white */
--navy-deep: 0 0% 100%;   /* pure white */
```

Every marketing CTA hardcodes `bg-navy … text-white` (Hero "Start Free Trial", Navbar/SiteNav "Start Free Trial" & "Dashboard", landing `Pricing` "Start Free Trial", `FinalCTA` "Start Free Trial") or `bg-white text-navy` (Hero "See Pricing" outline, `LiveDemo` "Call the Demo", `FinalCTA` "Talk to us" pairing). When the site is in dark mode, those pairings resolve to white-on-white (or navy-on-navy for the outline), which is the unreadable state you're seeing.

The brand identity treats navy as a dark color regardless of theme (light logo tile, dark navy CTA). The tokens should not have been inverted.

## Fix

Scope: pure CSS token change plus a couple of outline-button token swaps. No wording, size, spacing, or branding changes.

1. **`src/index.css` — `.dark` block:** stop inverting the brand navy tokens so `bg-navy` stays dark in dark mode.
   - Remove the dark-mode overrides for `--navy`, `--navy-deep`, and `--brand-soft` (let them inherit the `:root` dark-navy values). Result: `bg-navy text-white` renders dark-navy background + white text in both themes. WCAG AA passes (navy `215 55% 13%` vs white ≈ 14:1).
   - Leave `--slate-ink`/`--ink` overrides in place (those are body text tokens, correctly lightened for dark mode).

2. **Outline CTAs that hardcode `bg-white text-navy`:** switch to theme-aware tokens so they read correctly on a dark page background too. Only the class list changes; visual result in light mode is identical.
   - `src/components/landing/Hero.tsx` "See Pricing" button: `bg-white text-navy hover:bg-secondary` → `bg-background text-foreground hover:bg-secondary`.
   - `src/components/landing/LiveDemo.tsx` "Call the Demo" button (sits on the always-dark navy gradient section — keep `bg-white text-navy` because after step 1 `text-navy` is dark in both themes, so this remains dark-on-white ✅ no change needed).
   - `src/components/landing/FinalCTA.tsx` "Start Free Trial" (`bg-white text-navy`) sits on the always-dark navy gradient card — same reasoning, no change needed after step 1.

3. **Verify focus/hover/disabled states** on the affected buttons:
   - Primary (`bg-navy hover:bg-navy-deep text-white`): hover state uses `--navy-deep` which will now be the darker navy in both themes → white text stays legible; focus ring uses `--ring` (brand blue) which already contrasts; disabled uses shadcn's `disabled:opacity-50` — still legible against navy.
   - Outline "See Pricing": hover `bg-secondary` with `text-foreground` → AA in both themes.

4. **Cross-check the rest of the marketing surface** for the same pattern (`bg-navy … text-white`, `text-white` on `bg-white`, `text-navy` on dark) in: `SiteNav.tsx`, `SiteFooter.tsx`, landing `Navbar.tsx`, `Pricing.tsx`, `FinalCTA.tsx`, `Footer.tsx`, `Problem.tsx`, `SocialProof.tsx`, `Features.tsx`, `HowItWorks.tsx`, `FAQ.tsx`, `ActivityFeed.tsx`, and the marketing pages `Pricing.tsx`, `Demo.tsx`, `Index.tsx`. After step 1, all `text-white` on `bg-navy`/`bg-gradient-navy`/`bg-gradient-brand`/`bg-brand` pairings become legible automatically. Any residual `text-navy` on a light card also becomes legible (dark navy text). No further class edits expected, but I'll grep and confirm during implementation and patch any straggler I find.

5. **Manual verification with Playwright:** load `/` in light mode and again with `.dark` on `<html>`, screenshot the hero, nav, pricing card, live-demo section, and final CTA at desktop + mobile widths, and confirm each CTA label is readable.

## Files touched

- `src/index.css` (remove three lines in the `.dark` block)
- `src/components/landing/Hero.tsx` (one className swap on the outline CTA)
- Any straggler discovered during the grep pass in step 4 (expected: none)
