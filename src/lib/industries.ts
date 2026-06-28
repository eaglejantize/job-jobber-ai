export type IndustryItem = { value: string; label: string };
export type IndustryGroup = { value: string; label: string; items: IndustryItem[] };

export const INDUSTRY_GROUPS: IndustryGroup[] = [
  {
    value: "home_services",
    label: "Home Services",
    items: [
      { value: "appliance_repair", label: "Appliance Repair" },
      { value: "hvac", label: "HVAC" },
      { value: "plumbing", label: "Plumbing" },
      { value: "electrical", label: "Electrical" },
      { value: "garage_door", label: "Garage Door" },
      { value: "roofing", label: "Roofing" },
      { value: "pest_control", label: "Pest Control" },
      { value: "landscaping", label: "Landscaping" },
      { value: "lawn_care", label: "Lawn Care" },
      { value: "pool_service", label: "Pool Service" },
      { value: "irrigation", label: "Irrigation" },
      { value: "handyman", label: "Handyman" },
      { value: "painting", label: "Painting" },
      { value: "flooring", label: "Flooring" },
      { value: "drywall", label: "Drywall" },
      { value: "pressure_washing", label: "Pressure Washing" },
      { value: "junk_removal", label: "Junk Removal" },
      { value: "window_door_repair", label: "Window / Door Repair" },
      { value: "fence_deck", label: "Fence / Deck" },
      { value: "tree_service", label: "Tree Service" },
    ],
  },
  {
    value: "automotive",
    label: "Automotive",
    items: [
      { value: "auto_repair", label: "Auto Repair" },
      { value: "mobile_mechanic", label: "Mobile Mechanic" },
      { value: "tire_shop", label: "Tire Shop" },
      { value: "brake_shop", label: "Brake Shop" },
      { value: "transmission", label: "Transmission" },
      { value: "auto_glass", label: "Auto Glass" },
      { value: "towing_roadside", label: "Towing / Roadside" },
      { value: "fleet_maintenance", label: "Fleet Maintenance" },
      { value: "rv_repair", label: "RV Repair" },
      { value: "boat_repair", label: "Boat Repair" },
      { value: "motorcycle_powersports", label: "Motorcycle / Powersports" },
    ],
  },
  {
    value: "commercial_services",
    label: "Commercial Services",
    items: [
      { value: "facility_maintenance", label: "Facility Maintenance" },
      { value: "commercial_cleaning", label: "Commercial Cleaning" },
      { value: "commercial_kitchen", label: "Commercial Kitchen Equipment" },
      { value: "commercial_refrigeration", label: "Commercial Refrigeration" },
      { value: "office_equipment_repair", label: "Office Equipment Repair" },
      { value: "property_maintenance", label: "Property Maintenance" },
      { value: "apartment_maintenance", label: "Apartment Maintenance" },
      { value: "hoa_maintenance", label: "HOA Maintenance" },
    ],
  },
  {
    value: "industrial",
    label: "Industrial / Manufacturing",
    items: [
      { value: "industrial_maintenance", label: "Industrial Maintenance" },
      { value: "manufacturing_maintenance", label: "Manufacturing Maintenance" },
      { value: "cnc_machine_repair", label: "CNC / Machine Repair" },
      { value: "conveyor_systems", label: "Conveyor Systems" },
      { value: "packaging_equipment", label: "Packaging Equipment" },
      { value: "compressor_service", label: "Compressor Service" },
      { value: "forklift_repair", label: "Forklift Repair" },
      { value: "boiler_chiller_service", label: "Boiler / Chiller Service" },
      { value: "welding_fabrication", label: "Welding / Fabrication" },
      { value: "plant_equipment_service", label: "Plant Equipment Service" },
    ],
  },
  {
    value: "it_technical",
    label: "IT / Technical Services",
    items: [
      { value: "it_support", label: "IT Support" },
      { value: "computer_repair", label: "Computer Repair" },
      { value: "network_installation", label: "Network Installation" },
      { value: "low_voltage", label: "Low Voltage" },
      { value: "security_systems", label: "Security Systems" },
      { value: "audio_video", label: "Audio / Video" },
      { value: "telecom", label: "Telecom" },
    ],
  },
  {
    value: "cleaning",
    label: "Cleaning",
    items: [
      { value: "residential_cleaning", label: "Residential Cleaning" },
      { value: "commercial_cleaning_2", label: "Commercial Cleaning" },
      { value: "carpet_cleaning", label: "Carpet Cleaning" },
      { value: "window_cleaning", label: "Window Cleaning" },
      { value: "air_duct_cleaning", label: "Air Duct Cleaning" },
      { value: "move_out_cleaning", label: "Move-Out Cleaning" },
      { value: "vacation_rental_cleaning", label: "Vacation Rental Cleaning" },
    ],
  },
  {
    value: "logistics",
    label: "Logistics",
    items: [
      { value: "courier", label: "Courier" },
      { value: "delivery_service", label: "Delivery Service" },
      { value: "moving_company", label: "Moving Company" },
      { value: "storage", label: "Storage" },
      { value: "freight_dispatch", label: "Freight Dispatch" },
    ],
  },
  {
    value: "pet_services",
    label: "Pet Services",
    items: [
      { value: "mobile_grooming", label: "Mobile Grooming" },
      { value: "dog_training", label: "Dog Training" },
      { value: "pet_sitting", label: "Pet Sitting" },
      { value: "boarding", label: "Boarding" },
    ],
  },
  {
    value: "personal_services",
    label: "Personal Services",
    items: [
      { value: "tutoring", label: "Tutoring" },
      { value: "mobile_barber", label: "Mobile Barber" },
      { value: "beauty_services", label: "Beauty Services" },
      { value: "personal_training", label: "Personal Training" },
      { value: "event_rentals", label: "Event Rentals" },
    ],
  },
  {
    value: "specialty_trades",
    label: "Specialty Trades",
    items: [
      { value: "locksmith", label: "Locksmith" },
      { value: "sign_installation", label: "Sign Installation" },
      { value: "glass_repair", label: "Glass Repair" },
      { value: "masonry", label: "Masonry" },
      { value: "concrete", label: "Concrete" },
      { value: "waterproofing", label: "Waterproofing" },
      { value: "generator_service", label: "Generator Service" },
      { value: "solar_service", label: "Solar Service" },
      { value: "smart_home_installation", label: "Smart Home Installation" },
    ],
  },
  {
    value: "other",
    label: "Other",
    items: [{ value: "other", label: "Other Service Business" }],
  },
];

export const INDUSTRIES: IndustryItem[] = INDUSTRY_GROUPS.flatMap((g) => g.items);
export type IndustryValue = string;
export const INDUSTRY_VALUES = INDUSTRIES.map((i) => i.value) as [string, ...string[]];

export function industryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return INDUSTRIES.find((i) => i.value === value)?.label ?? value;
}

export function findIndustryGroup(value: string | null | undefined): IndustryGroup | null {
  if (!value) return null;
  return INDUSTRY_GROUPS.find((g) => g.items.some((i) => i.value === value)) ?? null;
}