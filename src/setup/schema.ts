import { z } from "zod";

export const INDUSTRY_OPTIONS = [
  { value: "appliance_repair", label: "Appliance Repair" },
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "general_home", label: "General Home Services" },
  { value: "other", label: "Other" },
] as const;

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export const DayHoursSchema = z.object({
  open: z.string().default("09:00"),
  close: z.string().default("17:00"),
  closed: z.boolean().default(false),
});
export type DayHours = z.infer<typeof DayHoursSchema>;

export const FaqSchema = z.object({
  q: z.string(),
  a: z.string(),
});
export type Faq = z.infer<typeof FaqSchema>;

export const NotifyEventSchema = z.enum([
  "new_call",
  "new_booking",
  "missed_call",
  "all_activity",
]);
export type NotifyEvent = z.infer<typeof NotifyEventSchema>;

export const SetupDataSchema = z.object({
  // Step 1
  google_place_id: z.string().default(""),
  google_rating: z.number().nullable().default(null),
  google_category: z.string().default(""),

  // Step 2
  business_name: z.string().default(""),
  owner_name: z.string().default(""),
  business_phone: z.string().default(""),
  address: z.string().default(""),
  industry: z.string().default(""),
  website: z.string().default(""),
  business_hours_schedule: z.record(z.string(), DayHoursSchema).default({}),
  timezone: z.string().default("America/New_York"),

  // Step 3
  preferred_area_code: z.string().default(""),
  assigned_callcapture_number: z.string().nullable().default(null),
  number_status: z.string().nullable().default(null),

  // Step 4
  voice_id: z.string().default(""),
  voice_label: z.string().default(""),
  tone: z.enum(["Professional", "Friendly", "Energetic"]).default("Friendly"),
  voice_speed: z.enum(["slow", "normal", "fast"]).default("normal"),
  rings_before_answer: z.number().int().min(1).max(4).default(2),

  // Step 5
  greeting: z.string().default(""),
  after_hours_message: z.string().default(""),
  services: z.array(z.string()).default([]),
  faqs: z.array(FaqSchema).default([]),

  // Step 6
  forward_phone: z.string().default(""),
  voicemail_fallback: z.boolean().default(true),
  after_hours_mode: z.enum(["voicemail", "forward", "ai"]).default("voicemail"),

  // Step 7
  notification_settings: z
    .object({
      sms_enabled: z.boolean().default(false),
      sms_phone: z.string().default(""),
      email_enabled: z.boolean().default(false),
      email: z.string().default(""),
      notify_on: z.array(NotifyEventSchema).default(["new_call"]),
    })
    .default({
      sms_enabled: false,
      sms_phone: "",
      email_enabled: false,
      email: "",
      notify_on: ["new_call"],
    }),

  // Step 8 — CRM
  crm_provider: z.string().nullable().default(null),
  crm_interest: z.array(z.string()).default([]),

  // Step 9 — Test call
  first_test_call_id: z.string().nullable().default(null),
});

export type SetupData = z.infer<typeof SetupDataSchema>;

export function emptySetupData(): SetupData {
  const hours: Record<string, DayHours> = {};
  for (const d of DAYS) {
    hours[d] = { open: "09:00", close: "17:00", closed: d === "Sun" };
  }
  return {
    google_place_id: "",
    google_rating: null,
    google_category: "",
    business_name: "",
    owner_name: "",
    business_phone: "",
    address: "",
    industry: "",
    website: "",
    business_hours_schedule: hours,
    timezone: "America/New_York",
    preferred_area_code: "",
    assigned_callcapture_number: null,
    number_status: null,
    voice_id: "",
    voice_label: "",
    tone: "Friendly",
    voice_speed: "normal",
    rings_before_answer: 2,
    greeting: "",
    after_hours_message: "",
    services: [],
    faqs: [],
    forward_phone: "",
    voicemail_fallback: true,
    after_hours_mode: "voicemail",
    notification_settings: {
      sms_enabled: false,
      sms_phone: "",
      email_enabled: false,
      email: "",
      notify_on: ["new_call"],
    },
    crm_provider: null,
    crm_interest: [],
    first_test_call_id: null,
  };
}

export const STEPS = [
  { id: 1, title: "Welcome to Vektuor", short: "Welcome" },
  { id: 2, title: "Find your business", short: "Business lookup" },
  { id: 3, title: "Business details", short: "Business details" },
  { id: 4, title: "Your Vektuor number", short: "Phone number" },
  { id: 5, title: "Choose your AI voice", short: "Voice" },
  { id: 6, title: "Your AI receptionist script", short: "Script" },
  { id: 7, title: "Call handling & forwarding", short: "Call handling" },
  { id: 8, title: "SMS & notifications", short: "Notifications" },
  { id: 9, title: "Connect your CRM", short: "CRM" },
  { id: 10, title: "Test your AI receptionist", short: "Test call" },
  { id: 11, title: "Go live", short: "Go live" },
] as const;
