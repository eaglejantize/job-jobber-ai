-- Add med spa config fields to callcapture_assistant_configs
ALTER TABLE callcapture_assistant_configs
  ADD COLUMN IF NOT EXISTS primary_treatments TEXT[] DEFAULT ARRAY['Botox', 'Filler', 'Microneedling'],
  ADD COLUMN IF NOT EXISTS callback_timeline TEXT DEFAULT 'within 24 hours',
  ADD COLUMN IF NOT EXISTS closed_days TEXT[] DEFAULT ARRAY['Sunday'];
