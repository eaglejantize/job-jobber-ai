export const INDUSTRIES = [
  { value: "appliance_repair", label: "Appliance Repair" },
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical / Electrician" },
  { value: "med_spa", label: "Med Spa / Aesthetics" },
  { value: "dental", label: "Dental / Medical Office" },
  { value: "auto_repair", label: "Auto Repair" },
  { value: "landscaping", label: "Landscaping / Lawn Care" },
  { value: "cleaning", label: "Cleaning Services" },
  { value: "general_contractor", label: "General Contractor" },
  { value: "other", label: "Other" },
] as const;

export type IndustryValue = (typeof INDUSTRIES)[number]["value"];

export const INDUSTRY_VALUES = INDUSTRIES.map((i) => i.value) as [
  IndustryValue,
  ...IndustryValue[],
];

export function industryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return INDUSTRIES.find((i) => i.value === value)?.label ?? value;
}