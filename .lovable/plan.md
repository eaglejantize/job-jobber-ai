# Navigation & App Structure Fix

Goal: cleanly separate the marketing site (logged-out) from the app shell (logged-in), restructure the dashboard, add a Settings page, and restore the Leads view.

## 1. Two navbars: marketing vs app

Split the current `SiteNav` into two components and pick which one to render based on auth state.

- `MarketingNav` (logged-out only) — keeps current links: Home, Demo, Pricing, Support + Login + Get Started.
- `AppNav` (logged-in only) — new component:
  - Left: Logo → `/dashboard`
  - Right (desktop): Dashboard, Leads, Settings, Sign out
  - Mobile: hamburger with the same four items
  - Active link highlighting via `NavLink`
  - "Sign out" calls `supabase.auth.signOut()` then navigates to `/`

Update `src/components/Layout.tsx` to read `useAuth()` and render `<AppNav />` when `user` exists, otherwise `<MarketingNav />`. Show a small spinner/blank header while `loading` to avoid flicker.

## 2. Route gating

Create two small wrapper components in `src/components/route-guards.tsx`:

- `RequireAuth` — if not logged in → `<Navigate to="/login" replace />`
- `RedirectIfAuthed` — if logged in → `<Navigate to="/dashboard" replace />` (used to keep marketing pages out of reach once logged in)

Apply in `src/App.tsx`:

| Route | Guard |
|---|---|
| `/`, `/demo`, `/pricing`, `/support` | `RedirectIfAuthed` (logged-in users get bounced to `/dashboard`) |
| `/start`, `/confirm` | public (signup/payment flow) |
| `/login`, `/auth` | `RedirectIfAuthed` |
| `/reset-password` | public |
| `/dashboard`, `/leads`, `/settings`, `/setup` | `RequireAuth` |

Keep `Support` reachable from inside the app via a small "Need help?" link in the AppNav dropdown or footer (so logged-in users still have a path to support without it being a top-level marketing item). Confirm: route `/support` will redirect logged-in users away — instead we'll keep `/support` accessible to everyone (no guard) so `RequestSetupBanner` links keep working, but it just won't appear in the AppNav.

## 3. New `/settings` page

Create `src/pages/Settings.tsx` that reuses the existing 6-step wizard logic from `Setup.tsx` but presented as tabbed sections (using existing shadcn `Tabs`):

- Business Info
- Phone Setup
- Call Handling
- AI Settings (combines AI Receptionist + Voice & Greeting)

Each tab shows the same fields as the corresponding wizard step with a single "Save changes" button per tab that writes to `callcapture_businesses` / `callcapture_assistant_configs` (same upsert logic Setup already uses). This way Setup remains the first-time guided flow and Settings is the ongoing editor.

Add route `/settings` in `App.tsx`.

## 4. Restore `/leads`

`/leads` and `LeadInbox.tsx` already exist and work — just make sure it's linked from AppNav (it currently isn't). Verify the empty-state copy matches the spec ("No leads yet — calls will appear here") and tweak if needed.

## 5. Dashboard restructure (`src/pages/Dashboard.tsx`)

Replace the current layout with:

```text
+--------------------------------------------------+
| Setup Status: Live  |  Business Phone: (xxx)…   |
+--------------------------------------------------+
| Quick Actions:  [Test My Agent]  [Edit Settings] |
+--------------------------------------------------+
| Recent Leads (5)                    View all →   |
|  - Sarah J.   (904)…   Refrigerator   2m ago     |
|  …                                               |
+--------------------------------------------------+
```

- Setup Status badge: keep existing logic.
- Business Phone: pull `phone` from `callcapture_businesses` (fallback to `alert_phone` from clients).
- "Test My Agent" → calls the demo number (use `DEMO_NUMBER_TEL` `tel:` link, same as `DemoNumberCard`).
- "Edit Settings" → `/settings`.
- Recent Leads: query `callcapture_leads` ordered by `created_at desc` limit 5; each row links to `/leads`. Empty state: "No leads yet — calls will appear here".
- Remove the raw "Your Assistant Instructions" `<pre>` block and the Vapi instructions accordion. (Keep the data fetch only if needed for status; otherwise drop it.)
- Keep `RequestSetupBanner` at the bottom.
- Sign-out button moves out of the page header (it now lives in AppNav).

## 6. Files touched

- `src/components/SiteNav.tsx` → rename/split into `MarketingNav.tsx` + `AppNav.tsx`
- `src/components/Layout.tsx` → conditional nav
- `src/components/route-guards.tsx` → new
- `src/App.tsx` → wrap routes with guards, add `/settings`
- `src/pages/Settings.tsx` → new (tabbed editor reusing wizard fields)
- `src/pages/Dashboard.tsx` → restructure (status, phone, quick actions, recent leads, drop raw prompt)
- `src/pages/LeadInbox.tsx` → minor empty-state copy tweak

## 7. What stays the same

- Auth flow (email + password), Stripe checkout, webhooks, Vapi/Twilio/SMS, lead capture, Setup wizard logic.
- Existing tables and RLS — no DB migrations needed.
- `/setup` remains the first-time guided wizard; new `/settings` is for editing afterward.
