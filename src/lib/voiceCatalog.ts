import { supabase } from "@/integrations/supabase/client";

export type VoiceSyncStatus = "synced" | "failed" | "pending";

export type VoiceCatalogOption = {
  id: string;
  customer_category: string;
  label: string;
  persona: string;
  provider: string;
  provider_voice_id: string;
  preview_url: string | null;
  preview_source: "provider" | "local";
  description: string | null;
  accent?: string | null;
  tone?: string | null;
  pace?: string | null;
  best_use?: string | null;
  verified_active: boolean;
  provider_verified: boolean;
  preview_verified: boolean;
  is_active: boolean;
  sort_order: number;
};

export type VoiceSelection = {
  selected_voice_catalog_id: string | null;
  voice_provider: string;
  voice_provider_voice_id: string;
  voice_id: string;
  voice_label: string;
};

export async function loadCuratedVoices(): Promise<{
  voices: VoiceCatalogOption[];
  source: "catalog";
  error?: string;
}> {
  const { data, error } = await supabase
    .from("callcapture_voice_catalog")
    .select(
      "id, customer_category, label, persona, provider, provider_voice_id, provider_preview_url, local_preview_url, preview_source, description, accent, tone, pace, best_use, verified_active, provider_verified, preview_verified, is_active, sort_order",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return { voices: [], source: "catalog", error: error.message };
  }
  if (!data || data.length === 0) {
    return { voices: [], source: "catalog" };
  }

  const normalized: VoiceCatalogOption[] = data.map((row) => {
    const r = row as unknown as {
      id: string;
      customer_category: string;
      label: string;
      persona: string;
      provider: string;
      provider_voice_id: string;
      provider_preview_url: string | null;
      local_preview_url: string | null;
      preview_source: "provider" | "local";
      description: string | null;
      accent: string | null;
      tone: string | null;
      pace: string | null;
      best_use: string | null;
      verified_active: boolean;
      provider_verified: boolean;
      preview_verified: boolean;
      is_active: boolean;
      sort_order: number;
    };
    return {
      id: r.id,
      customer_category: r.customer_category,
      label: r.label,
      persona: r.persona,
      provider: r.provider,
      provider_voice_id: r.provider_voice_id,
      preview_url: r.preview_source === "provider" ? r.provider_preview_url : r.local_preview_url,
      preview_source: r.preview_source,
      description: r.description,
      accent: r.accent,
      tone: r.tone,
      pace: r.pace,
      best_use: r.best_use,
      verified_active: r.verified_active,
      provider_verified: r.provider_verified,
      preview_verified: r.preview_verified,
      is_active: r.is_active,
      sort_order: r.sort_order,
    };
  });

  return { voices: normalized, source: "catalog" };
}

export function selectionFromOption(option: VoiceCatalogOption): VoiceSelection {
  return {
    selected_voice_catalog_id: option.id,
    voice_provider: option.provider,
    voice_provider_voice_id: option.provider_voice_id,
    voice_id: option.provider_voice_id,
    voice_label: option.label,
  };
}
