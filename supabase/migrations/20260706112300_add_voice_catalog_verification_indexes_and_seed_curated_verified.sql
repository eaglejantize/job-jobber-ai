CREATE INDEX IF NOT EXISTS idx_voice_catalog_active_sort
  ON public.callcapture_voice_catalog (is_active, sort_order, customer_category);

CREATE INDEX IF NOT EXISTS idx_voice_catalog_verified_active
  ON public.callcapture_voice_catalog (verified_active, is_active);

INSERT INTO public.callcapture_voice_catalog (
  customer_category,
  label,
  persona,
  provider,
  provider_voice_id,
  provider_preview_url,
  local_preview_url,
  preview_source,
  description,
  is_active,
  verified_active,
  sort_order,
  metadata
)
VALUES
  ('home_services', 'Jasmine', 'Warm Concierge', 'elevenlabs', 'jasmine', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3', NULL, 'provider', 'Warm and friendly; strong default for home service SMBs.', true, true, 10, '{"curated":true}'::jsonb),
  ('home_services', 'Marcus', 'Confident Technician', 'elevenlabs', 'marcus', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/7c65fe4d-1b6c-46f4-9e63-9b32a7d6d1ed.mp3', NULL, 'provider', 'Clear and confident male voice for technical calls.', true, true, 20, '{"curated":true}'::jsonb),
  ('med_spa', 'Claire', 'Luxury Concierge', 'elevenlabs', 'claire', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/942356dc-f10d-4d89-bda5-4f8505ee038e.mp3', NULL, 'provider', 'Polished and calming for premium customer experiences.', true, true, 30, '{"curated":true}'::jsonb),
  ('med_spa', 'Nova', 'Upbeat Specialist', 'elevenlabs', 'nova', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3', NULL, 'provider', 'Bright and upbeat for appointment-heavy businesses.', true, true, 40, '{"curated":true}'::jsonb),
  ('legal', 'James', 'Authoritative Advisor', 'elevenlabs', 'james', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3', NULL, 'provider', 'Deep and reassuring tone for trust-sensitive calls.', true, true, 50, '{"curated":true}'::jsonb),
  ('medical', 'Luna', 'Calm Intake', 'elevenlabs', 'luna', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3', NULL, 'provider', 'Soft and soothing voice for high-anxiety callers.', true, true, 60, '{"curated":true}'::jsonb),
  ('home_services', 'Ava', 'Steady Operator', 'elevenlabs', 'ava', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3', NULL, 'provider', 'Steady and reassuring for maintenance and dispatch calls.', true, true, 70, '{"curated":true}'::jsonb),
  ('home_services', 'Noah', 'Calm Authority', 'elevenlabs', 'noah', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-aafb-06a6e705cac5.mp3', NULL, 'provider', 'Calm authority profile for premium service interactions.', true, true, 80, '{"curated":true}'::jsonb)
ON CONFLICT (provider, provider_voice_id) DO UPDATE
SET
  customer_category = EXCLUDED.customer_category,
  label = EXCLUDED.label,
  persona = EXCLUDED.persona,
  provider_preview_url = EXCLUDED.provider_preview_url,
  local_preview_url = EXCLUDED.local_preview_url,
  preview_source = EXCLUDED.preview_source,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  verified_active = EXCLUDED.verified_active,
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata,
  updated_at = now();
