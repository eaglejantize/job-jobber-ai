
-- Appointments table
CREATE TABLE public.callcapture_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.callcapture_clients(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.callcapture_leads(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  customer_email text,
  customer_address text,
  service text,
  notes text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  calendar_provider text DEFAULT 'google',
  calendar_event_id text,
  calendar_event_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_appointments TO authenticated;
GRANT ALL ON public.callcapture_appointments TO service_role;

ALTER TABLE public.callcapture_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their appointments"
  ON public.callcapture_appointments
  FOR ALL
  TO authenticated
  USING (public.owns_client(client_id) OR public.is_current_user_super_admin())
  WITH CHECK (public.owns_client(client_id) OR public.is_current_user_super_admin());

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.callcapture_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_appointments_client_start ON public.callcapture_appointments(client_id, start_at);
CREATE INDEX idx_appointments_lead ON public.callcapture_appointments(lead_id);

-- Client columns for calendar config and per-tenant OAuth
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS google_calendar_id text,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS default_job_duration_minutes integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS business_hours jsonb,
  ADD COLUMN IF NOT EXISTS google_oauth_access_token text,
  ADD COLUMN IF NOT EXISTS google_oauth_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_oauth_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_oauth_scope text,
  ADD COLUMN IF NOT EXISTS google_oauth_email text,
  ADD COLUMN IF NOT EXISTS owner_email text;

-- Lead columns linking to booking
ALTER TABLE public.callcapture_leads
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.callcapture_appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS booking_status text DEFAULT 'unbooked';
