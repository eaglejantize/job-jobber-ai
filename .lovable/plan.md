## Goal
Build a Super Admin panel at `/admin`, gated by `callcapture_clients.is_super_admin`, plus an industry dropdown on `/start` and an "Admin" link in the main nav.

## Blockers to confirm before building

1. **No `industry` column exists on `callcapture_clients`.** The spec requires showing Industry in the Subscribers table and Create Test Account form, and capturing it on `/start`. I'll add `industry text` to `callcapture_clients` via migration.

2. **Current RLS only lets a user see/update their own row** (`auth.uid() = user_id`). For admin list/edit/delete to work, I'll add admin-scoped policies using `is_super_admin`:
   - `SELECT/UPDATE/DELETE` allowed when the calling user's row has `is_super_admin = true`.
   - Implemented via a `SECURITY DEFINER` function `public.is_current_user_super_admin()` to avoid recursive RLS.

3. **Hard delete from the client.** The spec says "Delete → hard delete with confirmation dialog." This will be a direct `supabase.from('callcapture_clients').delete()` call, allowed by the new admin DELETE policy. No Stripe/Auth cleanup — just the DB row, matching the spec.

4. **Test accounts have no auth user.** `user_id` stays null. The existing "anon signup insert" policy permits this; admin insert path will use the standard client and rely on a new admin INSERT policy too (so authenticated admins can insert without `user_id = auth.uid()`).

If any of these are wrong, say so before I start.

## Plan

### Database migration
- `ALTER TABLE callcapture_clients ADD COLUMN industry text;`
- Create `public.is_current_user_super_admin()` `SECURITY DEFINER` returning bool — checks the caller's row by `auth.uid()` (preferred) or email fallback.
- Add policies on `callcapture_clients`:
  - `admin select all` — SELECT using `is_current_user_super_admin()`
  - `admin update all` — UPDATE using/with-check `is_current_user_super_admin()`
  - `admin delete all` — DELETE using `is_current_user_super_admin()`
  - `admin insert any` — INSERT with check `is_current_user_super_admin()` (allows admin-created test accounts with null `user_id`)

### Frontend

**`src/hooks/useIsAdmin.tsx`** — React Query hook that, given a session, selects `is_super_admin` from `callcapture_clients` for the current user (by `user_id`, falling back to email). Returns `{ isAdmin, isLoading }`.

**`src/components/ProtectedAdminRoute.tsx`** — Wraps children, reads session + `useIsAdmin`, shows spinner while loading, redirects to `/login` if unauthenticated or not admin.

**`src/lib/industries.ts`** — Exported array of the 11 industries with `{ value, label }`.

**`src/pages/Start.tsx`**
- Add `industry` to Zod schema (required enum).
- Add shadcn `Select` between Business Name and Email.
- Pass `industry` in `create-checkout` body and in the direct `callcapture_clients` upsert.
- Aside card: "Built for {industryLabel ?? 'service businesses'}".

**`supabase/functions/create-checkout/index.ts`** — Accept and forward `industry` into the client row write. (Minimal change; doesn't touch the broader RLS flow.)

**`src/components/Layout.tsx`** — Use `useIsAdmin` to conditionally render an "Admin" nav link to `/admin`.

**`src/App.tsx`** — Add `/admin` route wrapped in `ProtectedAdminRoute`, rendering `AdminLayout` with nested tabs (or a single page with internal tab state — single page is simpler and matches the dark sidebar spec).

### Admin UI (`src/pages/admin/`)

Single page `Admin.tsx` with internal tab state, plus tab components:

- `AdminLayout` (in `Admin.tsx`) — slate-900 bg, slate-800 sidebar with Vektuor wordmark, nav items (Overview, Subscribers, Create Test Account, Settings), emerald-500 active left border.
- `OverviewTab.tsx` — 4 stat cards (total / active / pending / manual) + recent signups table (last 10, ordered by `created_at desc`).
- `SubscribersTab.tsx` — search input, status filter pills, full table, per-row shadcn `DropdownMenu` actions (Activate / Set Pending / Suspend / Delete-with-AlertDialog). Color-coded badges.
- `CreateTestAccountTab.tsx` — form (react-hook-form + zod), inserts with `crypto.randomUUID()` for `id`, null `user_id`, no Stripe. Toast with new id.
- `SettingsTab.tsx` — placeholder card.

All admin reads/writes go through the standard `supabase` client; the new admin RLS policies authorize them.

### Visual tokens
Admin pages use literal slate/emerald Tailwind classes since the rest of the app's design tokens aren't dark-ops themed and the spec is explicit. (One scoped exception to the "no hardcoded colors" rule, contained to `/admin`.)

## Out of scope
- No Stripe/Auth cleanup on hard delete.
- No edge function for admin actions — RLS policies cover it.
- No changes to the existing user-scoped policies.

## Verification
- Manually flip `is_super_admin = true` on one test row, sign in as that user, confirm `/admin` loads, list shows all rows, status changes persist, delete removes the row, non-admin users get redirected to `/login`.
- `/start` requires industry selection; submitted value lands on the new client row.
