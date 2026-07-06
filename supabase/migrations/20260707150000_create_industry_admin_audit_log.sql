-- Audit table for tracking admin edits to industry configs
CREATE TABLE IF NOT EXISTS public.callcapture_industry_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('definition', 'workflow')),
  entity_id uuid NOT NULL,
  entity_key text,
  action text NOT NULL CHECK (action IN ('create', 'update', 'activate', 'deactivate', 'delete')),
  before_snapshot jsonb,
  after_snapshot jsonb NOT NULL,
  validation_errors text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_callcapture_industry_audit_admin_user
  ON public.callcapture_industry_admin_audit(admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_callcapture_industry_audit_entity
  ON public.callcapture_industry_admin_audit(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_callcapture_industry_audit_action
  ON public.callcapture_industry_admin_audit(action, created_at DESC);

-- Enable RLS
ALTER TABLE public.callcapture_industry_admin_audit ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy
DROP POLICY IF EXISTS "industry_audit_admin_read" ON public.callcapture_industry_admin_audit;
CREATE POLICY "industry_audit_admin_read"
  ON public.callcapture_industry_admin_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.callcapture_clients
      WHERE callcapture_clients.user_id = auth.uid()
      AND callcapture_clients.is_super_admin = true
    )
  );

-- Admin-only insert policy
DROP POLICY IF EXISTS "industry_audit_admin_insert" ON public.callcapture_industry_admin_audit;
CREATE POLICY "industry_audit_admin_insert"
  ON public.callcapture_industry_admin_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.callcapture_clients
      WHERE callcapture_clients.user_id = auth.uid()
      AND callcapture_clients.is_super_admin = true
    )
  );

-- Grant permissions
GRANT SELECT ON public.callcapture_industry_admin_audit TO authenticated;
GRANT INSERT ON public.callcapture_industry_admin_audit TO authenticated;
GRANT ALL ON public.callcapture_industry_admin_audit TO service_role;

-- Add description/sort_order to industry definitions if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'callcapture_industry_definitions'
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.callcapture_industry_definitions
      ADD COLUMN description text,
      ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add is_default flag to definitions if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'callcapture_industry_definitions'
    AND column_name = 'is_default'
  ) THEN
    ALTER TABLE public.callcapture_industry_definitions
      ADD COLUMN is_default boolean NOT NULL DEFAULT false;
  END IF;
END $$;
