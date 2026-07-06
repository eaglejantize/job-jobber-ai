CREATE TABLE IF NOT EXISTS public.command_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_key text NOT NULL UNIQUE,
  action_key text NOT NULL,
  description text,
  required_context text[] NOT NULL DEFAULT '{}'::text[],
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.allowed_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL,
  role text NOT NULL DEFAULT 'authenticated',
  client_id uuid REFERENCES public.callcapture_clients(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (action_key, role, client_id)
);

CREATE TABLE IF NOT EXISTS public.command_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.callcapture_clients(id) ON DELETE SET NULL,
  command_text text NOT NULL,
  intent_key text,
  action_key text,
  status text NOT NULL CHECK (status IN ('success', 'blocked', 'error')),
  policy_reason text,
  result_summary text,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_command_intents_enabled
  ON public.command_intents(is_enabled, intent_key);

CREATE INDEX IF NOT EXISTS idx_allowed_actions_lookup
  ON public.allowed_actions(action_key, role, client_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_command_execution_log_user_time
  ON public.command_execution_log(user_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_command_execution_log_client_time
  ON public.command_execution_log(client_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_command_execution_log_intent
  ON public.command_execution_log(intent_key, executed_at DESC);

INSERT INTO public.command_intents (intent_key, action_key, description, required_context, is_enabled)
VALUES
  ('navigate_to_next_work_order', 'navigate_to_next_work_order', 'Move agent to the next work order in queue.', ARRAY['calls']::text[], true),
  ('summarize_current_job', 'summarize_current_job', 'Summarize the currently selected job.', ARRAY['currentCall']::text[], true)
ON CONFLICT (intent_key) DO UPDATE SET
  action_key = EXCLUDED.action_key,
  description = EXCLUDED.description,
  required_context = EXCLUDED.required_context,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

INSERT INTO public.allowed_actions (action_key, role, client_id, is_enabled)
VALUES
  ('navigate_to_next_work_order', 'authenticated', NULL, true),
  ('summarize_current_job', 'authenticated', NULL, true)
ON CONFLICT (action_key, role, client_id) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

ALTER TABLE public.command_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_execution_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "command_intents_read" ON public.command_intents;
CREATE POLICY "command_intents_read"
  ON public.command_intents
  FOR SELECT
  TO authenticated
  USING (is_enabled = true);

DROP POLICY IF EXISTS "allowed_actions_read" ON public.allowed_actions;
CREATE POLICY "allowed_actions_read"
  ON public.allowed_actions
  FOR SELECT
  TO authenticated
  USING (
    role = 'authenticated'
    AND (
      client_id IS NULL OR EXISTS (
        SELECT 1
        FROM public.callcapture_clients c
        WHERE c.id = allowed_actions.client_id
          AND c.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "command_execution_log_read_own" ON public.command_execution_log;
CREATE POLICY "command_execution_log_read_own"
  ON public.command_execution_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "command_execution_log_insert_own" ON public.command_execution_log;
CREATE POLICY "command_execution_log_insert_own"
  ON public.command_execution_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      client_id IS NULL OR EXISTS (
        SELECT 1
        FROM public.callcapture_clients c
        WHERE c.id = command_execution_log.client_id
          AND c.user_id = auth.uid()
      )
    )
  );

GRANT SELECT ON public.command_intents TO authenticated;
GRANT SELECT ON public.allowed_actions TO authenticated;
GRANT SELECT, INSERT ON public.command_execution_log TO authenticated;

GRANT ALL ON public.command_intents TO service_role;
GRANT ALL ON public.allowed_actions TO service_role;
GRANT ALL ON public.command_execution_log TO service_role;
