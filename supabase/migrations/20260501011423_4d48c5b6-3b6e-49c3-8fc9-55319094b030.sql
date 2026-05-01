
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP POLICY IF EXISTS "anyone can submit support" ON public.callcapture_support_requests;
CREATE POLICY "anyone can submit support"
ON public.callcapture_support_requests
FOR INSERT
WITH CHECK (length(trim(name)) > 0 AND length(trim(email)) > 0);
