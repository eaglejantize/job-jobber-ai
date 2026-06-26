
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS servanahq_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS servanahq_account_id text,
  ADD COLUMN IF NOT EXISTS servanahq_endpoint_url text;

ALTER TABLE public.callcapture_leads
  ADD COLUMN IF NOT EXISTS servanahq_lead_id text,
  ADD COLUMN IF NOT EXISTS servanahq_synced_at timestamptz;
