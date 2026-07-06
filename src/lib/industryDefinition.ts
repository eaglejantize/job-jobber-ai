export type IndustryPromptTemplate = "home_services" | "med_spa";

export type IndustryWorkflow = {
  key: string;
  name: string;
  defaultServices: string[];
  intakeQuestions: string[];
  aiPrompts: {
    systemPromptTemplate: IndustryPromptTemplate;
  };
  terminology: string[];
  workflows: string[];
  templates: string[];
  knowledgeBase: string[];
  automations: string[];
};

export type IndustryDefinition = {
  key: string;
  label: string;
  aliases: string[];
  industryValues: string[];
  defaultWorkflow: IndustryWorkflow;
  workflows: Record<string, IndustryWorkflow>;
};

export const UNIVERSAL_QUESTIONS: string[] = [
  "Caller name",
  "Phone number",
  "What they need help with",
  "Best time to call back",
];

const HOME_SERVICES_WORKFLOW: IndustryWorkflow = {
  key: "default",
  name: "Default Service Intake",
  defaultServices: ["Repair", "Installation", "Maintenance"],
  intakeQuestions: ["Service address (if applicable)", "Service needed", "Issue / problem", "Urgency"],
  aiPrompts: { systemPromptTemplate: "home_services" },
  terminology: ["service call", "dispatch", "follow-up"],
  workflows: ["new_lead_intake", "existing_customer_callback"],
  templates: ["standard_service_greeting", "standard_service_closing"],
  knowledgeBase: ["service area", "business hours", "standard escalation"],
  automations: ["lead_notification", "callback_queue"],
};

const MED_SPA_WORKFLOW: IndustryWorkflow = {
  key: "default",
  name: "Med Spa Concierge Intake",
  defaultServices: ["Consultation", "Treatment follow-up", "Appointment request"],
  intakeQuestions: [
    "Best callback time",
    "Service interested in (Botox, filler, laser, facial, etc.)",
    "New or returning client",
    "Preferred provider or no preference",
    "Any allergies or skin sensitivities",
    "Preferred appointment day/time",
    "How did you hear about us",
  ],
  aiPrompts: { systemPromptTemplate: "med_spa" },
  terminology: ["consultation", "treatment", "client"],
  workflows: ["new_inquiry", "existing_client", "pricing_deflection"],
  templates: ["med_spa_concierge_greeting", "med_spa_pricing_deflection"],
  knowledgeBase: ["treatment categories", "callback policy", "urgent escalation"],
  automations: ["new_client_followup", "urgent_existing_client_alert"],
};

const LEGACY_INDUSTRY_QUESTIONS: Record<string, string[]> = {
  hvac: ["Service address", "Type of system (AC, heat, etc.)", "Is it an emergency?"],
  plumbing: ["Service address", "Is there active water damage?", "Is it an emergency?"],
  electrical: ["Service address", "Any power out / safety concern?"],
  appliance_repair: ["Service address", "Appliance brand & model", "Age of appliance"],
  auto_repair: ["Vehicle year / make / model", "Symptoms / sounds", "Drivable?"],
  general_contractor: ["Project address", "Project type & scope", "Target timeline"],
  roofing: ["Property address", "Is the roof leaking now?", "Property type (residential/commercial)"],
  landscaping: ["Service address", "Type of work (mowing, design, install...)", "Property size"],
  cleaning: ["Service address", "One-time or recurring?", "Square footage / # bedrooms"],
  pest_control: ["Service address", "Type of pest", "How long has the issue been going on?"],
  pool_spa: ["Service address", "Pool / spa type & size", "Issue (cleaning, repair, opening...)"],
  garage_door: ["Service address", "Brand / opener type", "Is the door stuck open or closed?"],
  locksmith: ["Location of lockout", "Vehicle, residential, or commercial?", "Is it an emergency?"],
  moving: ["Pickup address", "Drop-off address", "Move date", "Approximate # of rooms / size"],
  med_spa: MED_SPA_WORKFLOW.intakeQuestions,
  dental: ["New or returning patient?", "Reason for visit", "Insurance carrier"],
  salon: ["Service requested", "Stylist preference (if any)", "Preferred date / time"],
  fitness: ["Goal (weight loss, strength, etc.)", "Experience level", "Preferred training times"],
  law_firm: ["Type of legal matter", "Jurisdiction / state", "Is this time-sensitive?"],
  accounting: ["Personal or business?", "Service needed (tax, bookkeeping, payroll...)", "Entity type (if business)"],
  real_estate: ["Buying, selling, or renting?", "Target neighborhood / area", "Budget range"],
  property_mgmt: ["Property address", "Tenant or owner?", "Reason for call"],
  auto_dealership: ["Sales or service?", "Vehicle of interest", "Trade-in?"],
  other: ["Service address (if any)", "Preferred follow-up time"],
};

const DEFAULT_DEFINITION: IndustryDefinition = {
  key: "service_business_default",
  label: "Service Business",
  aliases: ["service business"],
  industryValues: ["other"],
  defaultWorkflow: HOME_SERVICES_WORKFLOW,
  workflows: { default: HOME_SERVICES_WORKFLOW },
};

const MED_SPA_DEFINITION: IndustryDefinition = {
  key: "med_spa",
  label: "Med Spa",
  aliases: ["med spa", "medspa", "med-spa", "aesthetics", "med_spa"],
  industryValues: ["med_spa"],
  defaultWorkflow: MED_SPA_WORKFLOW,
  workflows: { default: MED_SPA_WORKFLOW },
};

const DEFINITIONS: IndustryDefinition[] = [MED_SPA_DEFINITION, DEFAULT_DEFINITION];

function normalizeIndustry(industry: string | null | undefined): string {
  return (industry ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isMedSpa(industry: string | null | undefined): boolean {
  const normalized = normalizeIndustry(industry);
  if (!normalized) return false;
  return MED_SPA_DEFINITION.aliases
    .map((a) => normalizeIndustry(a))
    .includes(normalized);
}

export function resolveIndustryDefinition(industry: string | null | undefined): IndustryDefinition {
  if (isMedSpa(industry)) return MED_SPA_DEFINITION;
  return DEFAULT_DEFINITION;
}

export function resolveIndustryWorkflow(industry: string | null | undefined): IndustryWorkflow {
  return resolveIndustryDefinition(industry).defaultWorkflow;
}

export function resolveIndustryQuestions(industry: string | null | undefined): string[] {
  const normalized = normalizeIndustry(industry);
  if (normalized && LEGACY_INDUSTRY_QUESTIONS[normalized]) {
    return [...UNIVERSAL_QUESTIONS, ...LEGACY_INDUSTRY_QUESTIONS[normalized]];
  }
  const workflowQuestions = resolveIndustryWorkflow(industry).intakeQuestions;
  return [...UNIVERSAL_QUESTIONS, ...workflowQuestions];
}

export function legacyIndustryQuestionsMap(): Record<string, string[]> {
  return { ...LEGACY_INDUSTRY_QUESTIONS };
}

export function industryDefinitionSeeds(): IndustryDefinition[] {
  return [...DEFINITIONS];
}
