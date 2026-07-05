UPDATE public.callcapture_clients
SET concierge_state = jsonb_set(concierge_state, '{step}', '0'::jsonb)
WHERE concierge_state IS NOT NULL
  AND (concierge_state->>'step')::int = 3
  AND assigned_callcapture_number IS NULL
  AND COALESCE(is_super_admin, false) = false
  AND onboarding_completed_at IS NULL;