create table if not exists public.callcapture_industry_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  aliases text[] not null default '{}',
  industry_values text[] not null default '{}',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.callcapture_industry_workflows (
  id uuid primary key default gen_random_uuid(),
  industry_definition_id uuid not null references public.callcapture_industry_definitions(id) on delete cascade,
  workflow_key text not null default 'default',
  workflow_name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  default_services text[] not null default '{}',
  intake_questions text[] not null default '{}',
  ai_prompts jsonb not null default '{}'::jsonb,
  terminology jsonb not null default '[]'::jsonb,
  workflows jsonb not null default '[]'::jsonb,
  templates jsonb not null default '[]'::jsonb,
  knowledge_base jsonb not null default '[]'::jsonb,
  automations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(industry_definition_id, workflow_key)
);

create index if not exists idx_callcapture_industry_definitions_key on public.callcapture_industry_definitions(key);
create index if not exists idx_callcapture_industry_workflows_definition on public.callcapture_industry_workflows(industry_definition_id, is_default);

insert into public.callcapture_industry_definitions (
  key,
  label,
  aliases,
  industry_values,
  metadata
)
values
  (
    'service_business_default',
    'Service Business',
    array['service business'],
    array['other'],
    '{"seeded":true,"compatibility":"legacy-default"}'::jsonb
  ),
  (
    'med_spa',
    'Med Spa',
    array['med_spa','med spa','med-spa','medspa','aesthetics'],
    array['med_spa'],
    '{"seeded":true,"compatibility":"legacy-med-spa"}'::jsonb
  )
on conflict (key) do update
set
  label = excluded.label,
  aliases = excluded.aliases,
  industry_values = excluded.industry_values,
  metadata = excluded.metadata,
  updated_at = now();

with defs as (
  select id, key from public.callcapture_industry_definitions where key in ('service_business_default', 'med_spa')
)
insert into public.callcapture_industry_workflows (
  industry_definition_id,
  workflow_key,
  workflow_name,
  is_default,
  default_services,
  intake_questions,
  ai_prompts,
  terminology,
  workflows,
  templates,
  knowledge_base,
  automations,
  metadata
)
select
  d.id,
  'default',
  case when d.key = 'med_spa' then 'Med Spa Concierge Intake' else 'Default Service Intake' end,
  true,
  case
    when d.key = 'med_spa' then array['Consultation','Treatment follow-up','Appointment request']
    else array['Repair','Installation','Maintenance']
  end,
  case
    when d.key = 'med_spa' then array[
      'Best callback time',
      'Service interested in (Botox, filler, laser, facial, etc.)',
      'New or returning client',
      'Preferred provider or no preference',
      'Any allergies or skin sensitivities',
      'Preferred appointment day/time',
      'How did you hear about us'
    ]
    else array[
      'Service address (if applicable)',
      'Service needed',
      'Issue / problem',
      'Urgency'
    ]
  end,
  case
    when d.key = 'med_spa' then '{"systemPromptTemplate":"med_spa"}'::jsonb
    else '{"systemPromptTemplate":"home_services"}'::jsonb
  end,
  case
    when d.key = 'med_spa' then '["consultation","treatment","client"]'::jsonb
    else '["service call","dispatch","follow-up"]'::jsonb
  end,
  case
    when d.key = 'med_spa' then '["new_inquiry","existing_client","pricing_deflection"]'::jsonb
    else '["new_lead_intake","existing_customer_callback"]'::jsonb
  end,
  case
    when d.key = 'med_spa' then '["med_spa_concierge_greeting","med_spa_pricing_deflection"]'::jsonb
    else '["standard_service_greeting","standard_service_closing"]'::jsonb
  end,
  case
    when d.key = 'med_spa' then '["treatment categories","callback policy","urgent escalation"]'::jsonb
    else '["service area","business hours","standard escalation"]'::jsonb
  end,
  case
    when d.key = 'med_spa' then '["new_client_followup","urgent_existing_client_alert"]'::jsonb
    else '["lead_notification","callback_queue"]'::jsonb
  end,
  '{"seeded":true}'::jsonb
from defs d
on conflict (industry_definition_id, workflow_key) do update
set
  workflow_name = excluded.workflow_name,
  is_default = excluded.is_default,
  default_services = excluded.default_services,
  intake_questions = excluded.intake_questions,
  ai_prompts = excluded.ai_prompts,
  terminology = excluded.terminology,
  workflows = excluded.workflows,
  templates = excluded.templates,
  knowledge_base = excluded.knowledge_base,
  automations = excluded.automations,
  metadata = excluded.metadata,
  updated_at = now();
