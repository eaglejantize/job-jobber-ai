
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS phone_mode text,
  ADD COLUMN IF NOT EXISTS preferred_area_code text,
  ADD COLUMN IF NOT EXISTS business_phone text,
  ADD COLUMN IF NOT EXISTS assigned_callcapture_number text,
  ADD COLUMN IF NOT EXISTS twilio_phone_number_sid text,
  ADD COLUMN IF NOT EXISTS number_status text,
  ADD COLUMN IF NOT EXISTS number_provisioned_at timestamptz;
