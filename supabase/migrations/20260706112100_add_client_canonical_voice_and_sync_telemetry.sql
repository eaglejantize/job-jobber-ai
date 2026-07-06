ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS selected_voice_catalog_id uuid REFERENCES public.callcapture_voice_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voice_provider text,
  ADD COLUMN IF NOT EXISTS voice_provider_voice_id text,
  ADD COLUMN IF NOT EXISTS voice_provider_agent_id text,
  ADD COLUMN IF NOT EXISTS voice_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS voice_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS voice_last_sync_error text,
  ADD COLUMN IF NOT EXISTS voice_phone_number_snapshot text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'callcapture_clients_voice_sync_status_check'
  ) THEN
    ALTER TABLE public.callcapture_clients
      ADD CONSTRAINT callcapture_clients_voice_sync_status_check
      CHECK (voice_sync_status IN ('synced', 'failed', 'pending'));
  END IF;
END $$;
