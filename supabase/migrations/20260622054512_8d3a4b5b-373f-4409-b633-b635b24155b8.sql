
ALTER TABLE public.callcapture_clients
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS voice_speed text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS after_hours_mode text NOT NULL DEFAULT 'voicemail',
  ADD COLUMN IF NOT EXISTS after_hours_message text,
  ADD COLUMN IF NOT EXISTS voicemail_fallback boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_settings jsonb NOT NULL DEFAULT '{"sms_enabled":false,"sms_phone":"","email_enabled":false,"email":"","notify_on":["new_call"]}'::jsonb,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_rating numeric,
  ADD COLUMN IF NOT EXISTS google_category text,
  ADD COLUMN IF NOT EXISTS setup_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS launched_at timestamptz;
