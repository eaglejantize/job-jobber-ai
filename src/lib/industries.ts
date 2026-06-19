export const INDUSTRIES = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical / Electrician" },
  { value: "appliance_repair", label: "Appliance Repair" },
  { value: "auto_repair", label: "Auto Repair" },
  { value: "general_contractor", label: "General Contractor" },
  { value: "roofing", label: "Roofing" },
  { value: "landscaping", label: "Landscaping / Lawn Care" },
  { value: "cleaning", label: "Cleaning Services" },
  { value: "pest_control", label: "Pest Control" },
  { value: "pool_spa", label: "Pool & Spa Service" },
  { value: "garage_door", label: "Garage Door Service" },
  { value: "locksmith", label: "Locksmith" },
  { value: "moving", label: "Moving & Hauling" },
  { value: "med_spa", label: "Med Spa / Aesthetics" },
  { value: "dental", label: "Dental Office" },
  { value: "salon", label: "Salon / Barber" },
  { value: "fitness", label: "Fitness / Personal Training" },
  { value: "law_firm", label: "Law Firm" },
  { value: "accounting", label: "Accounting / Bookkeeping" },
  { value: "real_estate", label: "Real Estate" },
  { value: "property_mgmt", label: "Property Management" },
  { value: "auto_dealership", label: "Auto Dealership" },
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