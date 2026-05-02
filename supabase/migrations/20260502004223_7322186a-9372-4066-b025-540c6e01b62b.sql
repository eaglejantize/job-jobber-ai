CREATE TABLE public.callcapture_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  phone       text,
  issue       text,
  type        text,
  urgency     text,
  address     text,
  raw_payload jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.callcapture_leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_callcapture_leads_created_at ON public.callcapture_leads (created_at DESC);