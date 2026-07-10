
-- 1. Voice catalog table
CREATE TABLE IF NOT EXISTS public.callcapture_voice_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_category text NOT NULL DEFAULT 'general',
  label text NOT NULL,
  persona text NOT NULL DEFAULT '',
  provider text NOT NULL,
  provider_voice_id text NOT NULL,
  provider_preview_url text,
  local_preview_url text,
  preview_source text NOT NULL DEFAULT 'provider' CHECK (preview_source IN ('provider','local')),
  description text,
  accent text,
  tone text,
  pace text,
  best_use text,
  verified_active boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_voice_id)
);

-- 2. Grants
GRANT SELECT ON public.callcapture_voice_catalog TO authenticated;
GRANT ALL    ON public.callcapture_voice_catalog TO service_role;

-- 3. RLS
ALTER TABLE public.callcapture_voice_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active voices"
  ON public.callcapture_voice_catalog
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- (No insert/update/delete policies -> only service_role, which bypasses RLS, may write.)

-- 4. updated_at trigger
DROP TRIGGER IF EXISTS trg_voice_catalog_updated_at ON public.callcapture_voice_catalog;
CREATE TRIGGER trg_voice_catalog_updated_at
  BEFORE UPDATE ON public.callcapture_voice_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Add missing tenant-side voice columns with FK for referential integrity
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS selected_voice_catalog_id uuid
    REFERENCES public.callcapture_voice_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voice_provider text,
  ADD COLUMN IF NOT EXISTS voice_provider_voice_id text,
  ADD COLUMN IF NOT EXISTS voice_provider_agent_id text;

CREATE INDEX IF NOT EXISTS idx_callcapture_clients_selected_voice_catalog_id
  ON public.callcapture_clients (selected_voice_catalog_id);
