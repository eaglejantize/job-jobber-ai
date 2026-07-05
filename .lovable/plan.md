## The real problem

The landing page mixes **hardcoded surface colors** (`bg-white`, `bg-gradient-hero`, `bg-gradient-navy`) with **semantic text tokens** (`text-navy`, `text-ink`, `text-muted-foreground`). Those text tokens flip in dark mode:

- `--navy` light: `215 55% 13%` (near-black) → dark mode: `210 20% 96%` (near-white)
- `--slate-ink` light: `215 22% 32%` (dark gray) → dark mode: `215 16% 72%` (light gray)

So the moment `.dark` is applied to `<html>` (via the theme toggle or system pref propagation elsewhere in the app), every section that still paints `bg-white` renders **near-white text on white** — headings, paragraphs, FAQ triggers, feature card titles, footer links all collapse. That's the low-contrast failure being reported. In pure light mode the palette is fine; the regression is theme-driven, not per-element.

## Fix strategy — one systemic change, no per-element patches

**Lock the marketing landing page to the light palette** and **stop hardcoding surface colors**. Text colors then always match the surface they sit on, in every browser theme state.

### 1. Scope the landing page to the light theme

In `src/pages/Index.tsx`, wrap the root in a `light` class and force color-scheme so the CSS variables always resolve to the light palette regardless of `<html class="dark">`:

```tsx
<div className="light min-h-screen bg-background font-sans [color-scheme:light]">
```

Add a `.light { … }` block in `src/index.css` that re-declares the same `:root` token values (so a `.dark` ancestor can't cascade into the landing). This is the single source of truth that guarantees `text-navy` = dark and `bg-background` = light on this page.

### 2. Replace hardcoded surfaces with semantic tokens

Every landing component that uses `bg-white` swaps to `bg-background` or `bg-card`. Every text token stays semantic. Files touched (surface swaps only, no per-element color overrides):

- `Navbar.tsx` — already `bg-background/80`, keep
- `Hero.tsx` — dashboard mockup chrome `bg-white` → `bg-card`, floating callout cards `bg-white` → `bg-card`
- `SocialProof.tsx` — `bg-white` → `bg-background` (section) 
- `Problem.tsx` — `bg-white` → `bg-background`; cards already `bg-card` 
- `HowItWorks.tsx` — already uses `bg-card`, keep
- `Features.tsx` — section `bg-white` → `bg-background`
- `LiveDemo.tsx` — stays `bg-gradient-navy` with `text-white` (intentional dark section, already correct)
- `ActivityFeed.tsx` — inner panel `bg-white` → `bg-card`, list items `bg-white` → `bg-card`
- `Pricing.tsx` — already `bg-card`, keep
- `FAQ.tsx` — section `bg-white` → `bg-background`; items already `bg-card`
- `FinalCTA.tsx` — stays `bg-gradient-navy` with `text-white` (intentional)
- `Footer.tsx` — `bg-white` → `bg-background`

Because Step 1 pins the palette, `bg-background` is always the light off-white and `bg-card` is always white — visual appearance in light mode is unchanged.

### 3. Verification

After the edits, run Playwright against `/` at 1280×1800:
1. Default theme — screenshot hero, social proof, problem, how it works, features, live demo, activity feed, pricing, FAQ, final CTA, footer.
2. Force `document.documentElement.classList.add('dark')` and re-screenshot the same sections. All text must remain readable because the landing is scoped to `.light`.
3. Visually confirm every heading, paragraph, badge, CTA label, card title, FAQ trigger, and footer link is legible against its surface. Also spot-check the intentional dark sections (LiveDemo, FinalCTA) still show white text on navy.

Only mark done after both theme states pass the visual review.

### Out of scope

No new colors, no per-element `text-*` overrides, no palette redesign. This is purely: (a) pin the landing to one palette, (b) route every surface through semantic tokens so foreground/background stay paired.
