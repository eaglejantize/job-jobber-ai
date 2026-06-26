ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id text,
  ADD COLUMN IF NOT EXISTS forwarding_from_number text,
  ADD COLUMN IF NOT EXISTS number_test_expires_at timestamptz;