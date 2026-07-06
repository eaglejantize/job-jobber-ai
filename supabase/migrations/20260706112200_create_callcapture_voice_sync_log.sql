CREATE TABLE IF NOT EXISTS public.callcapture_voice_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.callcapture_clients(id) ON DELETE CASCADE,
  voice_catalog_id uuid REFERENCES public.callcapture_voice_catalog(id) ON DELETE SET NULL,
  action text NOT NULL,
  status text NOT NULL,
  voice_provider text,
  provider_voice_id text,
  provider_agent_id text,
  phone_number_snapshot text,
  error_message text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT callcapture_voice_sync_log_status_check CHECK (status IN ('synced', 'failed', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_voice_sync_log_client_created
  ON public.callcapture_voice_sync_log (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_sync_log_status_created
  ON public.callcapture_voice_sync_log (status, created_at DESC);

ALTER TABLE public.callcapture_voice_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice sync log admin read" ON public.callcapture_voice_sync_log;
CREATE POLICY "voice sync log admin read"
  ON public.callcapture_voice_sync_log
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

GRANT SELECT ON public.callcapture_voice_sync_log TO authenticated;
GRANT ALL ON public.callcapture_voice_sync_log TO service_role;
