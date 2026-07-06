INSERT INTO public.command_intents (intent_key, action_key, description, required_context, is_enabled)
VALUES
  ('draft_on_the_way_sms', 'draft_on_the_way_sms', 'Draft an on-the-way SMS for the current job.', ARRAY['currentCall']::text[], true),
  ('add_job_note', 'add_job_note', 'Add a job note to the current work order.', ARRAY['currentCall']::text[], true)
ON CONFLICT (intent_key) DO UPDATE SET
  action_key = EXCLUDED.action_key,
  description = EXCLUDED.description,
  required_context = EXCLUDED.required_context,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

INSERT INTO public.allowed_actions (action_key, role, client_id, is_enabled)
VALUES
  ('draft_on_the_way_sms', 'authenticated', NULL, true),
  ('add_job_note', 'authenticated', NULL, true)
ON CONFLICT (action_key, role, client_id) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();
