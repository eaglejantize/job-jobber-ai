
ALTER TABLE public.callcapture_clients ADD COLUMN IF NOT EXISTS industry text;

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.callcapture_clients c
    WHERE c.is_super_admin = true
      AND (
        c.user_id = auth.uid()
        OR lower(c.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;

DROP POLICY IF EXISTS "admin select all" ON public.callcapture_clients;
CREATE POLICY "admin select all" ON public.callcapture_clients
  FOR SELECT TO authenticated
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "admin update all" ON public.callcapture_clients;
CREATE POLICY "admin update all" ON public.callcapture_clients
  FOR UPDATE TO authenticated
  USING (public.is_current_user_super_admin())
  WITH CHECK (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "admin delete all" ON public.callcapture_clients;
CREATE POLICY "admin delete all" ON public.callcapture_clients
  FOR DELETE TO authenticated
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "admin insert any" ON public.callcapture_clients;
CREATE POLICY "admin insert any" ON public.callcapture_clients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_super_admin());
