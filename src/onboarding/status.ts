// Onboarding state model + derivation. Single source of truth for the
// Concierge checklist. Status is computed from underlying client fields
// and merged with explicit user overrides (skipped / forced complete)
// stored on `callcapture_clients.onboarding_state`.

export type ItemStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "needs_attention"
  | "skipped";

export type ItemId =
  | "business_info"
  | "services"
  | "hours"
  | "phone_number"
  | "website_import"
  | "knowledge_base"
  | "ai_receptionist"
  | "integrations"
  | "test_call";

export type OnboardingItem = { status: ItemStatus; updated_at?: string };

export type OnboardingState = {
  items: Partial<Record<ItemId, OnboardingItem>>;
  activated_at: string | null;
  schema_version?: number;
};

export const ONBOARDING_STATE_SCHEMA_VERSION = 2;

export const ITEM_LABELS: Record<ItemId, string> = {
  business_info: "Business Profile",
  services: "Services",
  hours: "Business Hours",
  phone_number: "Business Phone Number",
  website_import: "Website Import",
  knowledge_base: "Knowledge Base",
  ai_receptionist: "AI Receptionist",
  integrations: "Integrations",
  test_call: "Test Call",
};

export const ITEM_ORDER: ItemId[] = [
  "business_info",
  "services",
  "hours",
  "phone_number",
  "website_import",
  "knowledge_base",
  "ai_receptionist",
  "integrations",
  "test_call",
];

export const REQUIRED_FOR_ACTIVATION: ItemId[] = [
  "business_info",
  "services",
  "hours",
  "phone_number",
  "ai_receptionist",
  "test_call",
];

// Required items where a user-initiated skip counts as satisfied for
// activation (e.g. test call — a customer may not be able to place one
// from their desktop).
export const SKIPPABLE_FOR_ACTIVATION: ItemId[] = ["test_call"];

function nonEmpty(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

type Client = Record<string, unknown> & {
  assigned_callcapture_number?: string | null;
  number_status?: string | null;
  webhook_status?: string | null;
  vapi_phone_number_id?: string | null;
  vapi_assistant_id?: string | null;
  business_name?: string | null;
  business_phone?: string | null;
  business_hours_24_7?: boolean | null;
  business_hours_schedule?: unknown;
  services?: string[] | null;
  faqs?: Array<{ q?: string; a?: string }> | null;
  knowledge_base?: string | null;
  google_calendar_connected_at?: string | null;
  voice_id?: string | null;
  voice_label?: string | null;
  greeting?: string | null;
  test_call_passed_at?: string | null;
  first_test_call_id?: string | null;
  google_place_id?: string | null;
  google_category?: string | null;
  website?: string | null;
};

function isPhoneReady(c: Client): boolean {
  if (!nonEmpty(c?.assigned_callcapture_number)) return false;
  if (c?.number_status !== "active") return false;
  if (c?.webhook_status !== "configured") return false;
  if (!nonEmpty(c?.vapi_phone_number_id)) return false;
  if (!nonEmpty(c?.vapi_assistant_id)) return false;
  return true;
}

function derived(c: Client): Record<ItemId, ItemStatus> {
  const has = (k: string) => nonEmpty(c?.[k]);
  const businessOk = has("business_name") && has("business_phone");
  const hoursOk = !!c?.business_hours_24_7 || nonEmpty(c?.business_hours_schedule);
  const services = (c?.services as string[] | null) ?? [];
  const servicesOk = services.filter((s) => s && s.trim().length).length > 0;
  const faqs = (c?.faqs as Array<{ q?: string; a?: string }> | null) ?? [];
  const faqsOk = faqs.some((f) => f?.q && f?.a);
  const knowledgeOk = has("knowledge_base") || faqsOk || servicesOk;
  const integrationsOk = !!c?.google_calendar_connected_at;
  const aiOk = (has("voice_id") || has("voice_label")) && has("greeting");
  const testCallOk = !!c?.test_call_passed_at || nonEmpty(c?.first_test_call_id);
  const gbpOk = has("google_place_id") || has("google_category");
  const phoneNumberOk = isPhoneReady(c);

  return {
    business_info:
      businessOk || gbpOk
        ? "complete"
        : has("business_name")
        ? "in_progress"
        : "not_started",
    services: servicesOk ? "complete" : "not_started",
    hours: hoursOk ? "complete" : "not_started",
    phone_number: phoneNumberOk
      ? "complete"
      : has("assigned_callcapture_number")
      ? "needs_attention"
      : "not_started",
    website_import: has("website") ? "complete" : "not_started",
    knowledge_base: knowledgeOk ? "complete" : "not_started",
    ai_receptionist: aiOk ? "complete" : "not_started",
    integrations: integrationsOk ? "complete" : "not_started",
    test_call: testCallOk ? "complete" : "not_started",
  };
}

export function deriveOnboardingState(
  c: Client | null | undefined,
  saved?: OnboardingState | null,
): OnboardingState {
  const items: OnboardingState["items"] = {};
  const d = derived(c ?? {});
  for (const id of ITEM_ORDER) {
    const override = saved?.items?.[id];
    const required = REQUIRED_FOR_ACTIVATION.includes(id);
    const skippableRequired = SKIPPABLE_FOR_ACTIVATION.includes(id);
    const canTreatSkippedAsSatisfied = !required || skippableRequired;

    // User overrides for optional/skippable "skipped" and explicit
    // "needs_attention" win. Required non-skippable items such as
    // Business Phone Number may never stay skipped unless the underlying
    // client fields make them complete.
    // Derived "complete" wins over stale/incomplete overrides.
    if (d[id] === "complete") {
      items[id] = { status: "complete" };
    } else if (override?.status === "skipped" && canTreatSkippedAsSatisfied) {
      items[id] = override;
    } else if (required && !canTreatSkippedAsSatisfied && override?.status === "complete") {
      items[id] = { status: d[id] };
    } else if (override?.status === "needs_attention") {
      items[id] = override;
    } else if (override) {
      items[id] = { ...override, status: override.status === "skipped" ? d[id] : override.status };
    } else {
      items[id] = { status: d[id] };
    }
  }

  const candidate: OnboardingState = {
    items,
    activated_at: saved?.activated_at ?? null,
    schema_version: ONBOARDING_STATE_SCHEMA_VERSION,
  };

  // Do not preserve an activated marker if a newly required non-skippable item
  // is missing. This prevents old 9-step onboarding state from bypassing the
  // restored Business Phone Number requirement.
  if (!isReadyToActivate(candidate).ready) {
    candidate.activated_at = null;
  }

  return candidate;
}

export function progressSummary(state: OnboardingState) {
  const total = ITEM_ORDER.length;
  const complete = ITEM_ORDER.filter((id) => {
    const s = state.items[id]?.status;
    if (s === "complete") return true;
    if (s !== "skipped") return false;
    return !REQUIRED_FOR_ACTIVATION.includes(id) || SKIPPABLE_FOR_ACTIVATION.includes(id);
  }).length;
  return { complete, total, pct: Math.round((complete / total) * 100) };
}

export function isReadyToActivate(state: OnboardingState): {
  ready: boolean;
  missing: ItemId[];
} {
  const missing = REQUIRED_FOR_ACTIVATION.filter((id) => {
    const s = state.items[id]?.status;
    if (s === "complete") return false;
    if (s === "skipped" && SKIPPABLE_FOR_ACTIVATION.includes(id)) return false;
    return true;
  });
  return { ready: missing.length === 0, missing };
}