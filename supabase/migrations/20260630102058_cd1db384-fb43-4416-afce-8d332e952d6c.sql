ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb,
  ADD COLUMN IF NOT EXISTS google_calendar_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_call_passed_at timestamptz;