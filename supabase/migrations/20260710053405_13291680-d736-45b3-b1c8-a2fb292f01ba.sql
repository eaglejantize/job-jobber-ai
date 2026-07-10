
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS voice_sync_status text,
  ADD COLUMN IF NOT EXISTS voice_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS voice_last_sync_error text,
  ADD COLUMN IF NOT EXISTS voice_phone_number_snapshot text;
