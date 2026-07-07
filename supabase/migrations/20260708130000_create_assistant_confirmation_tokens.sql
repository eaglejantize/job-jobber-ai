CREATE TABLE IF NOT EXISTS public.assistant_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.callcapture_clients(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  command_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_confirmation_tokens_user
  ON public.assistant_confirmation_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_assistant_confirmation_tokens_client
  ON public.assistant_confirmation_tokens(client_id);

CREATE INDEX IF NOT EXISTS idx_assistant_confirmation_tokens_expires
  ON public.assistant_confirmation_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_assistant_confirmation_tokens_user_action_used
  ON public.assistant_confirmation_tokens(user_id, action_key, used_at);

ALTER TABLE public.assistant_confirmation_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assistant_confirmation_tokens_select_own" ON public.assistant_confirmation_tokens;
CREATE POLICY "assistant_confirmation_tokens_select_own"
  ON public.assistant_confirmation_tokens
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.callcapture_clients c
      WHERE c.id = assistant_confirmation_tokens.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "assistant_confirmation_tokens_insert_own" ON public.assistant_confirmation_tokens;
CREATE POLICY "assistant_confirmation_tokens_insert_own"
  ON public.assistant_confirmation_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.callcapture_clients c
      WHERE c.id = assistant_confirmation_tokens.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "assistant_confirmation_tokens_update_own" ON public.assistant_confirmation_tokens;
CREATE POLICY "assistant_confirmation_tokens_update_own"
  ON public.assistant_confirmation_tokens
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.callcapture_clients c
      WHERE c.id = assistant_confirmation_tokens.client_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.callcapture_clients c
      WHERE c.id = assistant_confirmation_tokens.client_id
        AND c.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.assistant_confirmation_tokens TO authenticated;
GRANT ALL ON public.assistant_confirmation_tokens TO service_role;
