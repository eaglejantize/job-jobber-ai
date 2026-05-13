ALTER TABLE public.callcapture_leads
  ADD COLUMN IF NOT EXISTS treatment       text,
  ADD COLUMN IF NOT EXISTS new_or_returning text,
  ADD COLUMN IF NOT EXISTS timing          text,
  ADD COLUMN IF NOT EXISTS referral        text,
  ADD COLUMN IF NOT EXISTS summary         text,
  ADD COLUMN IF NOT EXISTS business_id     uuid REFERENCES public.callcapture_businesses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_callcapture_leads_business_created
  ON public.callcapture_leads (business_id, created_at DESC);
