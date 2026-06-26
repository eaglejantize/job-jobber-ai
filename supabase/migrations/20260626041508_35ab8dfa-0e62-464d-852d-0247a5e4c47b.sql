ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS servanahq_tenant_id text;

UPDATE public.callcapture_clients
   SET servanahq_tenant_id = servanahq_account_id
 WHERE servanahq_tenant_id IS NULL
   AND servanahq_account_id IS NOT NULL;

ALTER TABLE public.callcapture_clients
  DROP COLUMN IF EXISTS servanahq_account_id,
  DROP COLUMN IF EXISTS servanahq_endpoint_url;

ALTER TABLE public.callcapture_leads
  ADD COLUMN IF NOT EXISTS servanahq_sync_status text,
  ADD COLUMN IF NOT EXISTS servanahq_sync_error text;