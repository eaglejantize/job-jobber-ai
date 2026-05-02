GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_clients TO authenticated;
GRANT INSERT ON public.callcapture_clients TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_businesses TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_assistant_configs TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_leads TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.callcapture_support_requests TO authenticated;
GRANT INSERT ON public.callcapture_support_requests TO anon;