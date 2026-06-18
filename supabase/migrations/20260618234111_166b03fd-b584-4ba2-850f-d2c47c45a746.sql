
-- Fix callcapture_clients INSERT policy to prevent user_id spoofing
DROP POLICY IF EXISTS "anyone can submit signup" ON public.callcapture_clients;

CREATE POLICY "anon signup insert" ON public.callcapture_clients
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND length(trim(owner_name)) > 0
    AND length(trim(business_name)) > 0
    AND length(trim(email)) > 0
    AND length(trim(alert_phone)) > 0
  );

CREATE POLICY "auth signup insert" ON public.callcapture_clients
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND length(trim(owner_name)) > 0
    AND length(trim(business_name)) > 0
    AND length(trim(email)) > 0
    AND length(trim(alert_phone)) > 0
  );

-- Explicit DELETE policy on callcapture_clients
CREATE POLICY "own client delete" ON public.callcapture_clients
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- callcapture_leads: add INSERT/UPDATE/DELETE policies scoped to owning business.
-- Service role (edge functions) bypasses RLS, so webhook inserts continue to work.
CREATE POLICY "own leads insert" ON public.callcapture_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.callcapture_businesses b
      WHERE b.id = callcapture_leads.business_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "own leads update" ON public.callcapture_leads
  FOR UPDATE TO authenticated
  USING (
    business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.callcapture_businesses b
      WHERE b.id = callcapture_leads.business_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.callcapture_businesses b
      WHERE b.id = callcapture_leads.business_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "own leads delete" ON public.callcapture_leads
  FOR DELETE TO authenticated
  USING (
    business_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.callcapture_businesses b
      WHERE b.id = callcapture_leads.business_id
        AND b.user_id = auth.uid()
    )
  );
