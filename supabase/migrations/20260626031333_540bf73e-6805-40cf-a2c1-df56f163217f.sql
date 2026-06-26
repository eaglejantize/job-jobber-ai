
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS vapi_assistant_id text,
  ADD COLUMN IF NOT EXISTS webhook_status text;

ALTER TABLE public.callcapture_calls
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE TABLE IF NOT EXISTS public.callcapture_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.callcapture_clients(id) ON DELETE SET NULL,
  vapi_call_id text,
  step text NOT NULL,
  status text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.callcapture_webhook_events TO authenticated;
GRANT ALL ON public.callcapture_webhook_events TO service_role;

ALTER TABLE public.callcapture_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant reads own webhook events" ON public.callcapture_webhook_events;
CREATE POLICY "tenant reads own webhook events"
  ON public.callcapture_webhook_events FOR SELECT TO authenticated
  USING (public.owns_client(client_id) OR public.is_current_user_super_admin());

CREATE INDEX IF NOT EXISTS idx_webhook_events_call ON public.callcapture_webhook_events (vapi_call_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_client ON public.callcapture_webhook_events (client_id, created_at DESC);
