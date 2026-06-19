
-- callcapture_clients: wizard fields
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS business_hours_24_7 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS business_hours_schedule jsonb,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS rings_before_answer integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS forward_first boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forward_phone text,
  ADD COLUMN IF NOT EXISTS answer_after_hours boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS transfer_fallback text NOT NULL DEFAULT 'Take a message',
  ADD COLUMN IF NOT EXISTS transfer_triggers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS greeting text,
  ADD COLUMN IF NOT EXISTS include_business_name boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS human_pause boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS voice_id text,
  ADD COLUMN IF NOT EXISTS voice_label text,
  ADD COLUMN IF NOT EXISTS intake_questions jsonb,
  ADD COLUMN IF NOT EXISTS tone text NOT NULL DEFAULT 'Friendly';

-- callcapture_leads: tie to client + status + transcript + structured intake
ALTER TABLE public.callcapture_leads
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.callcapture_clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'New',
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS intake_answers jsonb;

CREATE INDEX IF NOT EXISTS idx_callcapture_leads_client_created
  ON public.callcapture_leads (client_id, created_at DESC);

-- RLS policies for client-scoped leads + admin
DROP POLICY IF EXISTS "own client leads select" ON public.callcapture_leads;
CREATE POLICY "own client leads select" ON public.callcapture_leads
  FOR SELECT TO authenticated
  USING (
    client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.callcapture_clients c
      WHERE c.id = callcapture_leads.client_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "own client leads update" ON public.callcapture_leads;
CREATE POLICY "own client leads update" ON public.callcapture_leads
  FOR UPDATE TO authenticated
  USING (
    client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.callcapture_clients c
      WHERE c.id = callcapture_leads.client_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.callcapture_clients c
      WHERE c.id = callcapture_leads.client_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin leads select" ON public.callcapture_leads;
CREATE POLICY "admin leads select" ON public.callcapture_leads
  FOR SELECT TO authenticated
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "admin leads all" ON public.callcapture_leads;
CREATE POLICY "admin leads all" ON public.callcapture_leads
  FOR ALL TO authenticated
  USING (public.is_current_user_super_admin())
  WITH CHECK (public.is_current_user_super_admin());

-- Enable Realtime
ALTER TABLE public.callcapture_leads REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='callcapture_leads';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.callcapture_leads';
  END IF;
END $$;
