export type SectionId =
  | "business_profile"
  | "industry"
  | "services"
  | "hours"
  | "service_area"
  | "emergency"
  | "scheduling"
  | "fee"
  | "greeting"
  | "after_hours"
  | "sms_followup"
  | "faqs"
  | "policies"
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

export const SECTIONS: SectionDef[] = [
  {
    id: "business_profile",
    title: "Business Profile",
    subtitle: "Confirm your business name, contact info, and address.",
    fields: ["business_name", "business_phone", "business_email", "address", "website"],
    aiSupported: false,
  },
  {
    id: "industry",
    title: "Industry",
    subtitle: "Pick the category that best fits your business.",
    fields: ["industry", "business_category_group"],
    aiSupported: false,
  },
  {
    id: "services",
    title: "Services Offered",
    subtitle: "List the main services callers can ask about.",
    fields: ["services"],
    aiSupported: true,
  },
  {
    id: "hours",
    title: "Business Hours",
    subtitle: "When are you open to take calls?",
    fields: ["business_hours_schedule", "business_hours_24_7"],
    aiSupported: false,
  },
  {
    id: "service_area",
    title: "Service Area",
    subtitle: "Where do you serve customers?",
    fields: ["service_area"],
    aiSupported: true,
  },
  {
    id: "emergency",
    title: "Emergency Service",
    subtitle: "Do you offer after-hours emergency service, and on what terms?",
    fields: ["emergency_services", "emergency_rules"],
    aiSupported: true,
  },
  {
    id: "scheduling",
    title: "Scheduling Preferences",
    subtitle: "Should the AI book appointments or just take messages?",
    fields: ["scheduling_enabled", "scheduling_mode"],
    aiSupported: false,
  },
  {
    id: "fee",
    title: "Service / Diagnostic Fee",
    subtitle: "Optional. What do you charge to come out?",
    fields: ["diagnostic_fee"],
    aiSupported: false,
  },
  {
    id: "greeting",
    title: "AI Greeting",
    subtitle: "The first thing callers hear.",
    fields: ["greeting"],
    aiSupported: true,
  },
  {
    id: "after_hours",
    title: "After-Hours Message",
    subtitle: "What the AI says when you're closed.",
    fields: ["after_hours_message"],
    aiSupported: true,
  },
  {
    id: "sms_followup",
    title: "SMS Follow-up",
    subtitle: "Text sent to the caller after the call ends.",
    fields: ["sms_followup_template"],
    aiSupported: true,
  },
  {
    id: "faqs",
    title: "FAQs",
    subtitle: "Questions callers ask, and the answers your AI should give.",
    fields: ["faqs"],
    aiSupported: true,
  },
  {
    id: "policies",
    title: "Policies",
    subtitle: "Cancellation, payment, guarantees — anything you want the AI to know.",
    fields: ["company_policies"],
    aiSupported: true,
  },
  {
    id: "review",
    title: "Review & Apply",
    subtitle: "Compare what's currently saved to what the concierge is proposing.",
    fields: [],
    aiSupported: false,
  },
];

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
};