// Universal intake questions asked on every call, plus industry-specific additions.

export const UNIVERSAL_QUESTIONS: string[] = [
  "Caller name",
  "Phone number",
  "What they need help with",
  "Best time to call back",
];

export const INDUSTRY_QUESTIONS: Record<string, string[]> = {
  hvac: ["Service address", "Type of system (AC, heat, etc.)", "Is it an emergency?"],
  plumbing: ["Service address", "Is there active water damage?", "Is it an emergency?"],
  electrical: ["Service address", "Any power out / safety concern?"],
  appliance_repair: ["Service address", "Appliance brand & model", "Age of appliance"],
  auto_repair: ["Vehicle year / make / model", "Symptoms / sounds", "Drivable?"],
  general_contractor: ["Project address", "Project type & scope", "Target timeline"],
  roofing: ["Property address", "Is the roof leaking now?", "Property type (residential/commercial)"],
  landscaping: ["Service address", "Type of work (mowing, design, install…)", "Property size"],
  cleaning: ["Service address", "One-time or recurring?", "Square footage / # bedrooms"],
  pest_control: ["Service address", "Type of pest", "How long has the issue been going on?"],
  pool_spa: ["Service address", "Pool / spa type & size", "Issue (cleaning, repair, opening…)"],
  garage_door: ["Service address", "Brand / opener type", "Is the door stuck open or closed?"],
  locksmith: ["Location of lockout", "Vehicle, residential, or commercial?", "Is it an emergency?"],
  moving: ["Pickup address", "Drop-off address", "Move date", "Approximate # of rooms / size"],
  med_spa: ["Treatment of interest", "New or returning client?", "Preferred date / time"],
  dental: ["New or returning patient?", "Reason for visit", "Insurance carrier"],
  salon: ["Service requested", "Stylist preference (if any)", "Preferred date / time"],
  fitness: ["Goal (weight loss, strength, etc.)", "Experience level", "Preferred training times"],
  law_firm: ["Type of legal matter", "Jurisdiction / state", "Is this time-sensitive?"],
  accounting: ["Personal or business?", "Service needed (tax, bookkeeping, payroll…)", "Entity type (if business)"],
  real_estate: ["Buying, selling, or renting?", "Target neighborhood / area", "Budget range"],
  property_mgmt: ["Property address", "Tenant or owner?", "Reason for call"],
  auto_dealership: ["Sales or service?", "Vehicle of interest", "Trade-in?"],
  other: ["Service address (if any)", "Preferred follow-up time"],
};

export function questionsForIndustry(industry: string | null | undefined): string[] {
  const extras = (industry && INDUSTRY_QUESTIONS[industry]) || INDUSTRY_QUESTIONS.other;
  return [...UNIVERSAL_QUESTIONS, ...extras];
}