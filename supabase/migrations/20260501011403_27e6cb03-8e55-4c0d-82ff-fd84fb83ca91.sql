
-- Businesses
CREATE TABLE public.callcapture_businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  phone TEXT,
  email TEXT,
  service_area TEXT,
  business_hours TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.callcapture_businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own businesses select" ON public.callcapture_businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own businesses insert" ON public.callcapture_businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own businesses update" ON public.callcapture_businesses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own businesses delete" ON public.callcapture_businesses FOR DELETE USING (auth.uid() = user_id);

-- Assistant configs
CREATE TABLE public.callcapture_assistant_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.callcapture_businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assistant_name TEXT,
  greeting TEXT,
  tone TEXT,
  after_hours_enabled BOOLEAN DEFAULT false,
  transfer_enabled BOOLEAN DEFAULT false,
  transfer_phone TEXT,
  intake_questions JSONB DEFAULT '[]'::jsonb,
  call_rules JSONB DEFAULT '{}'::jsonb,
  notification_settings JSONB DEFAULT '{}'::jsonb,
  generated_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.callcapture_assistant_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own configs select" ON public.callcapture_assistant_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own configs insert" ON public.callcapture_assistant_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own configs update" ON public.callcapture_assistant_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own configs delete" ON public.callcapture_assistant_configs FOR DELETE USING (auth.uid() = user_id);

-- Support requests (public insert; users can read their own by email match if signed in)
CREATE TABLE public.callcapture_support_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  business_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  request_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.callcapture_support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit support" ON public.callcapture_support_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "own support select" ON public.callcapture_support_requests FOR SELECT USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_configs_updated_at BEFORE UPDATE ON public.callcapture_assistant_configs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
