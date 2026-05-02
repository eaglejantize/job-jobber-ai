CREATE TABLE public.callcapture_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  owner_name text NOT NULL,
  business_name text NOT NULL,
  email text NOT NULL,
  alert_phone text NOT NULL,
  setup_status text NOT NULL DEFAULT 'Payment Pending',
  payment_status text NOT NULL DEFAULT 'Inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_callcapture_clients_user_id ON public.callcapture_clients(user_id);
CREATE INDEX idx_callcapture_clients_session ON public.callcapture_clients(stripe_checkout_session_id);
CREATE INDEX idx_callcapture_clients_subscription ON public.callcapture_clients(stripe_subscription_id);

ALTER TABLE public.callcapture_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit signup"
ON public.callcapture_clients
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(owner_name)) > 0
  AND length(trim(business_name)) > 0
  AND length(trim(email)) > 0
  AND length(trim(alert_phone)) > 0
);

CREATE POLICY "own client select"
ON public.callcapture_clients
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "own client update"
ON public.callcapture_clients
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_callcapture_clients_updated_at
BEFORE UPDATE ON public.callcapture_clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();