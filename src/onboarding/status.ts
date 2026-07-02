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
  | "google_business"
  | "website_import"
  | "knowledge_base"
  | "ai_receptionist"
  | "integrations"
  | "test_call";

export type OnboardingItem = { status: ItemStatus; updated_at?: string };

export type OnboardingState = {
  items: Partial<Record<ItemId, OnboardingItem>>;
  activated_at: string | null;
};

export const ITEM_LABELS: Record<ItemId, string> = {
  business_info: "Business Profile",
  services: "Services",
  hours: "Business Hours",
  google_business: "Google Business Profile",
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
  "google_business",
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
  "ai_receptionist",
  "test_call",
];

function nonEmpty(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

type Client = Record<string, any>;

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

  return {
    business_info: businessOk ? "complete" : has("business_name") ? "in_progress" : "not_started",
    services: servicesOk ? "complete" : "not_started",
    hours: hoursOk ? "complete" : "not_started",
    google_business: gbpOk ? "complete" : "not_started",
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
    // User overrides for "skipped" and explicit "needs_attention" win.
    // Derived "complete" wins over a stale "not_started" override.
    if (override?.status === "skipped" || override?.status === "needs_attention") {
      items[id] = override;
    } else if (d[id] === "complete") {
      items[id] = { status: "complete" };
    } else if (override) {
      items[id] = override;
    } else {
      items[id] = { status: d[id] };
    }
  }
  return { items, activated_at: saved?.activated_at ?? null };
}

export function progressSummary(state: OnboardingState) {
  const total = ITEM_ORDER.length;
  const complete = ITEM_ORDER.filter((id) => {
    const s = state.items[id]?.status;
    return s === "complete" || s === "skipped";
  }).length;
  return { complete, total, pct: Math.round((complete / total) * 100) };
}

export function isReadyToActivate(state: OnboardingState): {
  ready: boolean;
  missing: ItemId[];
} {
  const missing = REQUIRED_FOR_ACTIVATION.filter((id) => {
    const s = state.items[id]?.status;
    return s !== "complete";
  });
  return { ready: missing.length === 0, missing };
}