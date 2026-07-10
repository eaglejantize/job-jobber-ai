
ALTER TABLE public.callcapture_voice_catalog
  ADD COLUMN IF NOT EXISTS provider_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preview_verified  boolean NOT NULL DEFAULT false;

WITH seed(name, sort_order) AS (
  VALUES
    ('Emma',    10),
    ('Nico',    20),
    ('Sagar',   30),
    ('Kai',     40),
    ('Neil',    50),
    ('Clara',   60),
    ('Godfrey', 70),
    ('Layla',   80),
    ('Sid',     90),
    ('Naina',  100),
    ('Elliot', 110)
)
INSERT INTO public.callcapture_voice_catalog
  (customer_category, label, persona, provider, provider_voice_id,
   provider_preview_url, local_preview_url, preview_source,
   description, accent, tone, pace, best_use,
   provider_verified, preview_verified, verified_active,
   is_active, sort_order)
SELECT
  'general', name, 'Vapi native voice', 'vapi', name,
  NULL, NULL, 'provider',
  'Verified Vapi voice — preview to evaluate tone and fit.',
  NULL, NULL, NULL, NULL,
  true, false, true,
  true, sort_order
FROM seed
ON CONFLICT (provider, provider_voice_id) DO UPDATE SET
  label = EXCLUDED.label,
  persona = EXCLUDED.persona,
  customer_category = EXCLUDED.customer_category,
  preview_source = EXCLUDED.preview_source,
  description = EXCLUDED.description,
  accent = EXCLUDED.accent,
  tone = EXCLUDED.tone,
  pace = EXCLUDED.pace,
  best_use = EXCLUDED.best_use,
  provider_verified = EXCLUDED.provider_verified,
  preview_verified = EXCLUDED.preview_verified,
  verified_active = EXCLUDED.verified_active,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
