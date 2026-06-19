export const DEMO_NUMBER = "(904) 892-7004";
export const DEMO_NUMBER_TEL = "+19048927004";
export const DEMO_NUMBER_AVAILABLE = true;

import { INDUSTRIES as INDUSTRY_OPTIONS } from "./industries";
// Settings page uses string labels; derive from the canonical list.
export const INDUSTRIES = INDUSTRY_OPTIONS.map((i) => i.label);

export const TONES = ["Friendly", "Professional", "Direct", "Warm"] as const;
export type Tone = typeof TONES[number];

export const DEFAULT_INTAKE_QUESTIONS = [
  "Caller name",
  "Phone number",
  "Address",
  "Service needed",
  "Appliance / equipment type",
  "Model number",
  "Urgency",
  "Preferred appointment window",
  "Warranty or repeat customer",
];

export const TRANSFER_TRIGGERS = [
  "Emergency",
  "Angry customer",
  "Existing customer",
  "High-value job",
  "Caller requests human",
];

export const FALLBACK_ACTIONS = [
  "Take a message",
  "Send SMS to owner",
  "Tell customer someone will call back",
] as const;

export const REQUEST_TYPES = [
  "Set up my assistant",
  "Connect my phone number",
  "Build my script",
  "Test my demo",
  "Other",
];