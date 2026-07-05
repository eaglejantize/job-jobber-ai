export type SectionId =
  | "business_profile"
  | "services"
  | "hours"
  | "phone_number"
  | "website_import"
  | "knowledge"
  | "ai_receptionist"
  | "integrations"
  | "test_call"
  | "review";

export type SectionDef = {
  id: SectionId;
  title: string;
  subtitle: string;
  // Names of callcapture_clients fields the section can write.
  fields: string[];
  // Whether AI generation is supported for this section.
  aiSupported: boolean;
};

export const PHONE_NUMBER_SECTION: SectionDef = {
  id: "phone_number",
  title: "Business Phone Number",
  subtitle: "Claim a Vektuor number, bring your own, or forward your existing line.",
  fields: ["assigned_callcapture_number", "number_status"],
  aiSupported: false,
};

export function ensurePhoneNumberSection(sections: SectionDef[]): SectionDef[] {
  const withoutPhone = sections.filter((s) => s.id !== "phone_number");
  const before = withoutPhone.slice(0, 3);
  const after = withoutPhone.slice(3);
  return [...before, PHONE_NUMBER_SECTION, ...after];
}

const BASE_SECTIONS: SectionDef[] = [
  {
    id: "business_profile",
    title: "Business Profile",
    subtitle: "Import from Google, then confirm your business details.",
    fields: [
      "business_name",
      "business_phone",
      "business_email",
      "address",
      "website",
      "industry",
      "business_category_group",
      "google_place_id",
      "google_category",
      "google_rating",
    ],
    aiSupported: false,
  },
  {
    id: "services",
    title: "Services",
    subtitle: "List the main services callers can ask about.",
    fields: ["services", "service_area"],
    aiSupported: true,
  },
  {
    id: "hours",
    title: "Business Hours",
    subtitle: "When you're open, and how calls route during and after hours.",
    fields: ["business_hours_schedule", "business_hours_24_7", "phone_mode", "forward_first"],
    aiSupported: false,
  },
  PHONE_NUMBER_SECTION,
  {
    id: "website_import",
    title: "Website Import",
    subtitle: "Have us read your website and prefill your setup.",
    fields: ["website"],
    aiSupported: false,
  },
  {
    id: "knowledge",
    title: "Knowledge Base",
    subtitle: "FAQs, policies, and anything else your AI should know.",
    fields: ["knowledge_base", "faqs", "company_policies"],
    aiSupported: true,
  },
  {
    id: "ai_receptionist",
    title: "AI Receptionist",
    subtitle: "Voice, personality, greeting, and how the AI handles calls.",
    fields: [
      "tone", "ai_personality", "voice_id", "voice_label", "greeting",
      "after_hours_message", "forward_phone", "voicemail_enabled",
      "voicemail_fallback", "sms_followup_template", "rings_before_answer",
    ],
    aiSupported: false,
  },
  {
    id: "integrations",
    title: "Integrations",
    subtitle: "Connect your calendar and other tools. Skip any you don't use.",
    fields: ["google_calendar_id"],
    aiSupported: false,
  },
  {
    id: "test_call",
    title: "Test Call",
    subtitle: "Place a real call to your AI receptionist to confirm everything works.",
    fields: [],
    aiSupported: false,
  },
  {
    id: "review",
    title: "Review & Activate",
    subtitle: "Review your setup and activate your AI receptionist.",
    fields: [],
    aiSupported: false,
  },
];

export const SECTIONS: SectionDef[] = ensurePhoneNumberSection(BASE_SECTIONS);

export const FIELD_LABELS: Record<string, string> = {
  business_name: "Business name",
  business_phone: "Business phone",
  business_email: "Business email",
  address: "Address",
  website: "Website",
  industry: "Industry",
  business_category_group: "Industry group",
  services: "Services offered",
  business_hours_schedule: "Business hours",
  business_hours_24_7: "Open 24/7",
  service_area: "Service area",
  emergency_services: "Emergency service available",
  emergency_rules: "Emergency rules",
  scheduling_enabled: "Scheduling enabled",
  scheduling_mode: "Scheduling mode",
  diagnostic_fee: "Service / diagnostic fee",
  greeting: "AI greeting (first message)",
  after_hours_message: "After-hours message",
  sms_followup_template: "SMS follow-up template",
  faqs: "FAQs",
  company_policies: "Company policies",
  tone: "Tone",
  ai_personality: "AI personality",
  voice_id: "Voice",
  voice_label: "Voice label",
  phone_mode: "Phone routing mode",
  forward_first: "Forward before AI answers",
  rings_before_answer: "Rings before AI answers",
  forward_phone: "Forward-to phone",
  voicemail_enabled: "Voicemail enabled",
  voicemail_fallback: "Voicemail fallback",
  google_calendar_id: "Google Calendar",
  knowledge_base: "Knowledge base",
  assigned_callcapture_number: "Vektuor phone number",
  number_status: "Number status",
};