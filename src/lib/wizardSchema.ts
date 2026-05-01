import { z } from "zod";

export const wizardSchema = z.object({
  // Step 1
  businessName: z.string().trim().min(1, "Required").max(120),
  industry: z.string().min(1, "Pick one"),
  phone: z.string().trim().min(7, "Enter a phone number").max(30),
  email: z.string().trim().email("Enter a valid email").max(160),
  serviceArea: z.string().trim().max(160).optional().or(z.literal("")),
  businessHours: z.string().trim().max(160).optional().or(z.literal("")),
  // Step 2
  assistantName: z.string().trim().min(1, "Give your receptionist a name").max(60),
  greeting: z.string().trim().min(5, "Write a greeting").max(280),
  tone: z.enum(["Friendly", "Professional", "Direct", "Warm"]),
  afterHoursEnabled: z.boolean(),
  transferEnabled: z.boolean(),
  transferPhone: z.string().trim().max(30).optional().or(z.literal("")),
  // Step 3
  intakeQuestions: z.array(z.string()).default([]),
  // Step 4
  transferTriggers: z.array(z.string()).default([]),
  fallbackAction: z.string().min(1),
  // Step 5
  ownerName: z.string().trim().max(120).optional().or(z.literal("")),
  ownerSms: z.string().trim().max(30).optional().or(z.literal("")),
  ownerEmail: z.string().trim().max(160).optional().or(z.literal("")),
  sendSms: z.boolean(),
  sendEmail: z.boolean(),
});

export type WizardState = z.infer<typeof wizardSchema>;

export const defaultWizardState: WizardState = {
  businessName: "",
  industry: "",
  phone: "",
  email: "",
  serviceArea: "",
  businessHours: "Mon–Fri 8am–6pm",
  assistantName: "Riley",
  greeting: "Thanks for calling, how can I help you today?",
  tone: "Friendly",
  afterHoursEnabled: true,
  transferEnabled: true,
  transferPhone: "",
  intakeQuestions: ["Caller name", "Phone number", "Address", "Service needed", "Urgency"],
  transferTriggers: ["Emergency", "Caller requests human"],
  fallbackAction: "Take a message",
  ownerName: "",
  ownerSms: "",
  ownerEmail: "",
  sendSms: true,
  sendEmail: true,
};

const STORAGE_KEY = "callcapture.wizard";

export function loadWizardState(): WizardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultWizardState;
    return { ...defaultWizardState, ...JSON.parse(raw) };
  } catch {
    return defaultWizardState;
  }
}

export function saveWizardState(state: WizardState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearWizardState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}