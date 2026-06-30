export type SectionId =
  | "business_profile"
  | "industry"
  | "google_business"
  | "website_import"
  | "services"
  | "hours"
  | "hours_routing"
  | "call_forwarding"
  | "voicemail"
  | "service_area"
  | "emergency"
  | "scheduling"
  | "fee"
  | "ai_personality"
  | "voice"
  | "greeting"
  | "after_hours"
  | "sms_followup"
  | "calendar"
  | "faqs"
  | "knowledge"
  | "policies"
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
    id: "google_business",
    title: "Google Business Profile",
    subtitle: "Import your business details from Google.",
    fields: ["google_place_id", "google_category", "google_rating"],
    aiSupported: false,
  },
  {
    id: "website_import",
    title: "Website Import",
    subtitle: "Have us read your website and prefill your setup.",
    fields: ["website"],
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
    id: "hours_routing",
    title: "Business Hours Routing",
    subtitle: "How calls are handled during open hours.",
    fields: ["phone_mode", "forward_first", "rings_before_answer"],
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
    id: "ai_personality",
    title: "AI Personality",
    subtitle: "Pick a tone and persona for your AI receptionist.",
    fields: ["tone", "ai_personality"],
    aiSupported: false,
  },
  {
    id: "voice",
    title: "Voice Selection",
    subtitle: "Choose the voice your callers will hear.",
    fields: ["voice_id", "voice_label"],
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
    id: "call_forwarding",
    title: "Call Forwarding",
    subtitle: "Where transferred calls should land.",
    fields: ["forward_phone"],
    aiSupported: false,
  },
  {
    id: "voicemail",
    title: "Voicemail",
    subtitle: "Capture a message when the call can't continue.",
    fields: ["voicemail_enabled", "voicemail_fallback"],
    aiSupported: false,
  },
  {
    id: "sms_followup",
    title: "SMS Follow-up",
    subtitle: "Text sent to the caller after the call ends.",
    fields: ["sms_followup_template"],
    aiSupported: true,
  },
  {
    id: "calendar",
    title: "Calendar Connection",
    subtitle: "Connect Google Calendar so the AI can book real appointments.",
    fields: ["google_calendar_id"],
    aiSupported: false,
  },
  {
    id: "faqs",
    title: "FAQs",
    subtitle: "Questions callers ask, and the answers your AI should give.",
    fields: ["faqs"],
    aiSupported: true,
  },
  {
    id: "knowledge",
    title: "Knowledge Base",
    subtitle: "Anything else your AI should know about your business.",
    fields: ["knowledge_base"],
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
    id: "test_call",
    title: "Test Call",
    subtitle: "Place a real call to your AI receptionist to confirm everything works.",
    fields: [],
    aiSupported: false,
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
};