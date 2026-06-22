# Billing Bypass Toggle in Admin Settings

Replace the env-var-only switch with a database-backed toggle that the super admin can flip live from `Admin → Settings`.

## Database

New singleton settings table:

```sql
CREATE TABLE public.callcapture_app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  bypass_billing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.callcapture_app_settings TO authenticated;
GRANT ALL ON public.callcapture_app_settings TO service_role;
ALTER TABLE public.callcapture_app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin reads settings"
  ON public.callcapture_app_settings FOR SELECT TO authenticated
  USING (public.is_current_user_super_admin());

CREATE POLICY "super admin writes settings"
  ON public.callcapture_app_settings FOR UPDATE TO authenticated
  USING (public.is_current_user_super_admin())
  WITH CHECK (public.is_current_user_super_admin());

INSERT INTO public.callcapture_app_settings (id) VALUES (true)
  ON CONFLICT DO NOTHING;
```

The `CHECK (id = true)` plus boolean PK guarantees a single row.

## Edge function: `signup-tenant`

Update the bypass resolution order (first match wins):

1. `BYPASS_BILLING` env secret = `true`/`1` → bypass (server override).
2. `callcapture_app_settings.bypass_billing = true` → bypass (admin toggle).
3. `ALLOW_DEV_BYPASS_HEADER=true` AND request body `dev_bypass=true` → bypass.
4. Otherwise → Stripe checkout.

Read the settings row with the service-role client. Log `billing_bypassed { reason: "server_flag" | "admin_toggle" | "dev_header" }`.

## Admin UI: `SettingsTab` in `src/pages/Admin.tsx`

Replace the "coming soon" placeholder with a real settings panel.

- On mount: `select bypass_billing, updated_at from callcapture_app_settings limit 1`.
- Render a labeled switch ("Bypass Stripe checkout — new signups get a 30-day trial instead of paying") plus the last-updated timestamp.
- On toggle: optimistic update, then `update callcapture_app_settings set bypass_billing = ?, updated_at = now(), updated_by = auth.uid() where id = true`. Show success / error toast. Revert on failure.
- Show a warning callout when the toggle is ON: "Live signups will skip payment. Turn off for production launch."

Uses the existing `@/components/ui/switch` shadcn component.

## Frontend signup flow

No change to `src/pages/Start.tsx`. The dev-host hint stays in place; the new admin toggle is purely server-resolved.

## Verification

1. Settings tab loads with toggle reflecting current DB value.
2. Toggle ON → new signup lands on `/dashboard` with `payment_status=trial`, `setup_status=Active (Trial)`, `trial_ends_at ≈ now+30d`. No Stripe redirect.
3. Toggle OFF → new signup redirects to Stripe Checkout.
4. Non-super-admin user gets RLS denial when trying to read/update settings (verified by visiting `/admin` as a regular user — guard already blocks the route, but RLS is the backstop).

## Files

- new migration creating `callcapture_app_settings`
- `supabase/functions/signup-tenant/index.ts` — read settings row, add `admin_toggle` reason
- `src/pages/Admin.tsx` — replace `SettingsTab` with toggle
