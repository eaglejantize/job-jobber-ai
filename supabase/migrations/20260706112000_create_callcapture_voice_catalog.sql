CREATE TABLE IF NOT EXISTS public.callcapture_voice_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_category text NOT NULL,
  label text NOT NULL,
  persona text NOT NULL,
  provider text NOT NULL,
  provider_voice_id text NOT NULL,
  provider_preview_url text,
  local_preview_url text,
  preview_source text NOT NULL DEFAULT 'provider',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  verified_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT callcapture_voice_catalog_preview_source_check
    CHECK (preview_source IN ('provider', 'local'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_catalog_provider_voice_unique
  ON public.callcapture_voice_catalog (provider, provider_voice_id);

ALTER TABLE public.callcapture_voice_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voice catalog read" ON public.callcapture_voice_catalog;
CREATE POLICY "voice catalog read"
  ON public.callcapture_voice_catalog
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.callcapture_voice_catalog TO authenticated;
GRANT ALL ON public.callcapture_voice_catalog TO service_role;

DROP TRIGGER IF EXISTS trg_voice_catalog_updated_at ON public.callcapture_voice_catalog;
CREATE TRIGGER trg_voice_catalog_updated_at
BEFORE UPDATE ON public.callcapture_voice_catalog
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
