export type IndustryPromptTemplate = "service_receptionist" | "med_spa_concierge";

export type IndustryWorkflow = {
  key: string;
  name: string;
  default_services: string[];
  intake_questions: string[];
  ai_prompts: {
    system_prompt_template: IndustryPromptTemplate;
  };
  terminology: string[];
  workflows: string[];
  templates: string[];
  knowledge_base: string[];
  automations: string[];
};

export type IndustryDefinition = {
  key: string;
  label: string;
  aliases: string[];
  industry_values: string[];
  default_workflow: IndustryWorkflow;
};

export type IndustryLookupOption = {
  label: string;
  value: string;
};

const INDUSTRY_LOOKUP_OPTIONS: IndustryLookupOption[] = [
  { label: "HVAC", value: "hvac" },
  { label: "Plumbing", value: "plumbing" },
  { label: "Electrical / Electrician", value: "electrical" },
  { label: "Appliance Repair", value: "appliance_repair" },
  { label: "Auto Repair", value: "auto_repair" },
  { label: "General Contractor", value: "general_contractor" },
  { label: "Roofing", value: "roofing" },
  { label: "Landscaping / Lawn Care", value: "landscaping" },
  { label: "Cleaning Services", value: "cleaning" },
  { label: "Pest Control", value: "pest_control" },
  { label: "Pool & Spa Service", value: "pool_spa" },
  { label: "Garage Door Service", value: "garage_door" },
  { label: "Locksmith", value: "locksmith" },
  { label: "Moving & Hauling", value: "moving" },
  { label: "Med Spa / Aesthetics", value: "med_spa" },
  { label: "Dental Office", value: "dental" },
  { label: "Salon / Barber", value: "salon" },
  { label: "Fitness / Personal Training", value: "fitness" },
  { label: "Law Firm", value: "law_firm" },
  { label: "Accounting / Bookkeeping", value: "accounting" },
  { label: "Real Estate", value: "real_estate" },
  { label: "Property Management", value: "property_mgmt" },
  { label: "Auto Dealership", value: "auto_dealership" },
  { label: "Other", value: "other" },
];

const DEFAULT_WORKFLOW: IndustryWorkflow = {
  key: "default",
  name: "Default Service Intake",
  default_services: ["Repair", "Installation", "Maintenance"],
  intake_questions: ["Service address", "Service needed", "Issue / problem", "Urgency"],
  ai_prompts: { system_prompt_template: "service_receptionist" },
  terminology: ["service call", "dispatch", "follow-up"],
  workflows: ["new_lead_intake", "existing_customer_callback"],
  templates: ["standard_service_greeting"],
  knowledge_base: ["service area", "business hours"],
  automations: ["lead_notification"],
};

const MED_SPA_WORKFLOW: IndustryWorkflow = {
  key: "default",
  name: "Med Spa Concierge Intake",
  default_services: ["Consultation", "Treatment follow-up", "Appointment request"],
  intake_questions: [
    "Best callback time",
    "Service interested in",
    "New or returning client",
    "Preferred provider",
    "Preferred appointment day/time",
  ],
  ai_prompts: { system_prompt_template: "med_spa_concierge" },
  terminology: ["consultation", "treatment", "client"],
  workflows: ["new_inquiry", "existing_client", "pricing_deflection"],
  templates: ["med_spa_concierge_greeting"],
  knowledge_base: ["treatment categories", "callback policy", "urgent escalation"],
  automations: ["new_client_followup", "urgent_existing_client_alert"],
};

const MED_SPA_DEFINITION: IndustryDefinition = {
  key: "med_spa",
  label: "Med Spa",
  aliases: ["med_spa", "med spa", "med-spa", "medspa", "aesthetics"],
  industry_values: ["med_spa"],
  default_workflow: MED_SPA_WORKFLOW,
};

const DEFAULT_DEFINITION: IndustryDefinition = {
  key: "service_business_default",
  label: "Service Business",
  aliases: ["service business"],
  industry_values: ["other"],
  default_workflow: DEFAULT_WORKFLOW,
};

function normalizeIndustryValue(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function resolveIndustryDefinition(industry: string | null | undefined): IndustryDefinition {
  const normalized = normalizeIndustryValue(industry);
  const isMedSpa = MED_SPA_DEFINITION.aliases
    .map((alias) => normalizeIndustryValue(alias))
    .includes(normalized);

  if (isMedSpa) return MED_SPA_DEFINITION;
  return DEFAULT_DEFINITION;
}

export function resolveIndustryWorkflow(industry: string | null | undefined): IndustryWorkflow {
  return resolveIndustryDefinition(industry).default_workflow;
}

export function getIndustryLookupOptions(): IndustryLookupOption[] {
  return [...INDUSTRY_LOOKUP_OPTIONS];
}

export function getIndustryLookupLabels(): string[] {
  return INDUSTRY_LOOKUP_OPTIONS.map((option) => option.label);
}

export function industryValueFromLookupLabel(label: string | null | undefined): string {
  const normalized = String(label ?? "").trim();
  const found = INDUSTRY_LOOKUP_OPTIONS.find((option) => option.label === normalized);
  return found?.value ?? "other";
}

export function buildIndustryDefaultGreeting(industry: string | null | undefined, businessName: string | null | undefined): string {
  const name = businessName ?? "our office";
  const workflow = resolveIndustryWorkflow(industry);
  if (workflow.ai_prompts.system_prompt_template === "med_spa_concierge") {
    return `Thank you for calling ${name}, your personal concierge is here. How may I assist you today?`;
  }
  return `Thanks for calling ${name}. How can I help you today?`;
}

// ============================================================================
// VALIDATORS (Zod)
// ============================================================================

import { z } from "npm:zod@^3.25.76";

const VALID_PROMPT_TEMPLATES = z.enum(["service_receptionist", "med_spa_concierge"]);

export const IndustryWorkflowSchema = z.object({
  key: z.string().min(1, "Workflow key required"),
  name: z.string().min(1, "Workflow name required").max(200, "Name too long"),
  default_services: z.array(z.string()).min(1, "At least one service required"),
  intake_questions: z.array(z.string()).min(1, "At least one intake question required"),
  ai_prompts: z.object({
    system_prompt_template: VALID_PROMPT_TEMPLATES,
  }),
  terminology: z.array(z.string()),
  workflows: z.array(z.string()),
  templates: z.array(z.string()),
  knowledge_base: z.array(z.string()),
  automations: z.array(z.string()),
});

export const IndustryDefinitionCreateSchema = z.object({
  key: z.string().min(1, "Key required").max(100, "Key too long").regex(/^[a-z0-9_]+$/, "Key must be lowercase alphanumeric with underscores"),
  label: z.string().min(1, "Label required").max(200, "Label too long"),
  aliases: z.array(z.string()).min(0),
  industry_values: z.array(z.string()).min(0),
  description: z.string().max(500, "Description too long").optional(),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  metadata: z.record(z.unknown()).default({}),
});

export const IndustryDefinitionUpdateSchema = IndustryDefinitionCreateSchema.partial().required({
  key: true,
});

export const IndustryWorkflowCreateSchema = z.object({
  industry_definition_id: z.string().uuid("Invalid industry definition ID"),
  workflow_key: z.string().min(1, "Workflow key required"),
  workflow_name: z.string().min(1, "Workflow name required").max(200),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
  default_services: z.array(z.string()).min(1, "At least one service required"),
  intake_questions: z.array(z.string()).min(1, "At least one intake question required"),
  ai_prompts: z.object({
    system_prompt_template: VALID_PROMPT_TEMPLATES,
  }),
  terminology: z.array(z.string()).default([]),
  workflows: z.array(z.string()).default([]),
  templates: z.array(z.string()).default([]),
  knowledge_base: z.array(z.string()).default([]),
  automations: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const IndustryWorkflowUpdateSchema = IndustryWorkflowCreateSchema.partial().required({
  industry_definition_id: true,
  workflow_key: true,
});

export type ValidatedIndustryDefinition = z.infer<typeof IndustryDefinitionCreateSchema>;
export type ValidatedIndustryWorkflow = z.infer<typeof IndustryWorkflowCreateSchema>;
