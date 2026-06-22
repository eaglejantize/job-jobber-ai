CREATE TABLE public.callcapture_app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  bypass_billing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, UPDATE ON public.callcapture_app_settings TO authenticated;
GRANT ALL ON public.callcapture_app_settings TO service_role;

ALTER TABLE public.callcapture_app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin reads settings"
  ON public.callcapture_app_settings FOR SELECT TO authenticated
  USING (public.is_current_user_super_admin());

CREATE POLICY "super admin updates settings"
  ON public.callcapture_app_settings FOR UPDATE TO authenticated
  USING (public.is_current_user_super_admin())
  WITH CHECK (public.is_current_user_super_admin());

INSERT INTO public.callcapture_app_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;