
-- Enums
DO $$ BEGIN
  CREATE TYPE public.call_status AS ENUM ('live','new','booked','transferred','completed','missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transcript_role AS ENUM ('ai','caller');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.technician_status AS ENUM ('available','assigned','en_route','off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dispatch_status AS ENUM ('assigned','en_route','arrived','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sms_direction AS ENUM ('outbound','inbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: ownership check for a client_id
CREATE OR REPLACE FUNCTION public.owns_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.callcapture_clients c
    WHERE c.id = _client_id
      AND (
        c.user_id = auth.uid()
        OR lower(c.email) = lower(coalesce((auth.jwt() ->> 'email'),''))
      )
  );
$$;

-- ============ callcapture_calls ============
CREATE TABLE public.callcapture_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.callcapture_clients(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.callcapture_businesses(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.callcapture_leads(id) ON DELETE SET NULL,
  caller_name text,
  caller_phone text,
  issue_summary text,
  status public.call_status NOT NULL DEFAULT 'live',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,
  vapi_call_id text UNIQUE,
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX callcapture_calls_client_started_idx ON public.callcapture_calls (client_id, started_at DESC);
CREATE INDEX callcapture_calls_status_idx ON public.callcapture_calls (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_calls TO authenticated;
GRANT ALL ON public.callcapture_calls TO service_role;
ALTER TABLE public.callcapture_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_owner_select" ON public.callcapture_calls
  FOR SELECT TO authenticated USING (public.owns_client(client_id) OR public.is_current_user_super_admin());
CREATE POLICY "calls_owner_modify" ON public.callcapture_calls
  FOR ALL TO authenticated
  USING (public.owns_client(client_id) OR public.is_current_user_super_admin())
  WITH CHECK (public.owns_client(client_id) OR public.is_current_user_super_admin());

CREATE TRIGGER calls_set_updated_at BEFORE UPDATE ON public.callcapture_calls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ callcapture_transcript_turns ============
CREATE TABLE public.callcapture_transcript_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.callcapture_calls(id) ON DELETE CASCADE,
  role public.transcript_role NOT NULL,
  text text NOT NULL,
  seq int NOT NULL DEFAULT 0,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transcript_turns_call_seq_idx ON public.callcapture_transcript_turns (call_id, seq, at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_transcript_turns TO authenticated;
GRANT ALL ON public.callcapture_transcript_turns TO service_role;
ALTER TABLE public.callcapture_transcript_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "turns_owner_select" ON public.callcapture_transcript_turns
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.callcapture_calls c WHERE c.id = call_id
            AND (public.owns_client(c.client_id) OR public.is_current_user_super_admin()))
  );
CREATE POLICY "turns_owner_modify" ON public.callcapture_transcript_turns
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.callcapture_calls c WHERE c.id = call_id
            AND (public.owns_client(c.client_id) OR public.is_current_user_super_admin()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.callcapture_calls c WHERE c.id = call_id
            AND (public.owns_client(c.client_id) OR public.is_current_user_super_admin()))
  );

-- ============ callcapture_technicians ============
CREATE TABLE public.callcapture_technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.callcapture_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  status public.technician_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_technicians TO authenticated;
GRANT ALL ON public.callcapture_technicians TO service_role;
ALTER TABLE public.callcapture_technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tech_owner_select" ON public.callcapture_technicians
  FOR SELECT TO authenticated USING (public.owns_client(client_id) OR public.is_current_user_super_admin());
CREATE POLICY "tech_owner_modify" ON public.callcapture_technicians
  FOR ALL TO authenticated
  USING (public.owns_client(client_id) OR public.is_current_user_super_admin())
  WITH CHECK (public.owns_client(client_id) OR public.is_current_user_super_admin());

CREATE TRIGGER tech_set_updated_at BEFORE UPDATE ON public.callcapture_technicians
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ callcapture_dispatch ============
CREATE TABLE public.callcapture_dispatch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL UNIQUE REFERENCES public.callcapture_calls(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES public.callcapture_technicians(id) ON DELETE SET NULL,
  status public.dispatch_status NOT NULL DEFAULT 'assigned',
  eta_minutes int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_dispatch TO authenticated;
GRANT ALL ON public.callcapture_dispatch TO service_role;
ALTER TABLE public.callcapture_dispatch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispatch_owner_select" ON public.callcapture_dispatch
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.callcapture_calls c WHERE c.id = call_id
            AND (public.owns_client(c.client_id) OR public.is_current_user_super_admin()))
  );
CREATE POLICY "dispatch_owner_modify" ON public.callcapture_dispatch
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.callcapture_calls c WHERE c.id = call_id
            AND (public.owns_client(c.client_id) OR public.is_current_user_super_admin()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.callcapture_calls c WHERE c.id = call_id
            AND (public.owns_client(c.client_id) OR public.is_current_user_super_admin()))
  );

CREATE TRIGGER dispatch_set_updated_at BEFORE UPDATE ON public.callcapture_dispatch
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ callcapture_sms_messages ============
CREATE TABLE public.callcapture_sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES public.callcapture_calls(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.callcapture_leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.callcapture_clients(id) ON DELETE CASCADE,
  to_phone text,
  body text NOT NULL,
  direction public.sms_direction NOT NULL DEFAULT 'outbound',
  status text DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sms_call_idx ON public.callcapture_sms_messages (call_id, sent_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_sms_messages TO authenticated;
GRANT ALL ON public.callcapture_sms_messages TO service_role;
ALTER TABLE public.callcapture_sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_owner_select" ON public.callcapture_sms_messages
  FOR SELECT TO authenticated USING (public.owns_client(client_id) OR public.is_current_user_super_admin());
CREATE POLICY "sms_owner_modify" ON public.callcapture_sms_messages
  FOR ALL TO authenticated
  USING (public.owns_client(client_id) OR public.is_current_user_super_admin())
  WITH CHECK (public.owns_client(client_id) OR public.is_current_user_super_admin());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.callcapture_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.callcapture_transcript_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.callcapture_technicians;
ALTER PUBLICATION supabase_realtime ADD TABLE public.callcapture_dispatch;
ALTER PUBLICATION supabase_realtime ADD TABLE public.callcapture_sms_messages;
