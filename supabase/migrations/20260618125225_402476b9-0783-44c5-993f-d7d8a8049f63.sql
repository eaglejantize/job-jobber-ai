
-- Add subscription/payment columns to callcapture_businesses for the new signup flow
ALTER TABLE public.callcapture_businesses
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_callcapture_businesses_updated_at ON public.callcapture_businesses;
CREATE TRIGGER trg_callcapture_businesses_updated_at
  BEFORE UPDATE ON public.callcapture_businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tighten lead tenant isolation: previously SELECT policy was `true` for any
-- authenticated user, leaking leads across tenants. Scope by business owner.
DROP POLICY IF EXISTS "authenticated can read leads" ON public.callcapture_leads;

CREATE POLICY "own leads select" ON public.callcapture_leads
  FOR SELECT TO authenticated
  USING (
    business_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.callcapture_businesses b
      WHERE b.id = public.callcapture_leads.business_id
        AND b.user_id = auth.uid()
    )
  );

-- Allow service role full access for edge functions (webhook inserts, etc.)
GRANT ALL ON public.callcapture_businesses TO service_role;
GRANT ALL ON public.callcapture_leads TO service_role;
