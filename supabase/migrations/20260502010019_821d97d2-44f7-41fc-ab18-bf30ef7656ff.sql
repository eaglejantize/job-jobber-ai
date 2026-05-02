CREATE POLICY "authenticated can read leads"
ON public.callcapture_leads
FOR SELECT
TO authenticated
USING (true);