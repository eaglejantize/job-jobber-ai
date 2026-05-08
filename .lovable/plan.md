## Plan: Update pricing from $197/month to $249/month

### Scope
Update all pricing references from $197/month to $249/month across the homepage, pricing page, CTA buttons, and Stripe checkout edge function. Update the lead capture feature description on the homepage. No layout, styling, or logic changes.

### Files to modify

#### 1. `src/pages/Index.tsx`
- **Line 33** — Update feature list: `"Lead capture (name, phone, address, treatment)"` → `"Lead capture (name, phone, treatment, timing, referral source)"`
- **Line 303** — Update pricing display: `$197` → `$249`

#### 2. `src/pages/Pricing.tsx`
- **Line 22** — Update subheadline: `"Pays for itself with 1–2 captured jobs."` → `"Pays for itself with 1–2 captured consultations."`
- **Line 30** — Update pricing display: `$197` → `$249`

#### 3. `src/pages/Demo.tsx`
- **Line 34** — Update CTA button: `"Get Started — $99 + $197/mo"` → `"Get Started — $99 + $249/mo"`

#### 4. `src/components/RequestSetupBanner.tsx`
- **Line 41** — Update CTA button: `"Get Started — $99 + $197/mo"` → `"Get Started — $99 + $249/mo"`

#### 5. `supabase/functions/create-checkout/index.ts`
- **Line 65** — Update `unit_amount: 19700` → `unit_amount: 24900`
- Add comment above subscription line: `// $249/month subscription`
- Add comment above setup fee line: `// $99 one-time setup fee`

### No changes to
- Layout, styling, component structure, or logic in any file.
- Any files not listed above.