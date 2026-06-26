
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_provider text,
  ADD COLUMN IF NOT EXISTS crm_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_test_call_id uuid,
  ADD COLUMN IF NOT EXISTS crm_interest text[] DEFAULT '{}'::text[];
