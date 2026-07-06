import { supabase } from "@/integrations/supabase/client";
import { VOICES } from "@/lib/voices";

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
  verified_active: boolean;
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

function toLegacyFallback(): VoiceCatalogOption[] {
  return VOICES.map((v, idx) => ({
    id: `legacy-${v.id}`,
    customer_category: "legacy",
    label: v.label,
    persona: v.persona,
    provider: "vapi",
    provider_voice_id: "Elliot",
    preview_url: v.previewUrl,
    preview_source: "local",
    description: v.description,
    verified_active: false,
    is_active: true,
    sort_order: idx + 1000,
  }));
}

export async function loadCuratedVoices(): Promise<{ voices: VoiceCatalogOption[]; source: "catalog" | "legacy" }> {
  const { data, error } = await (supabase
    .from("callcapture_voice_catalog" as never) as {
      select: (columns: string) => {
        eq: (column: string, value: boolean) => {
          order: (column: string, opts: { ascending: boolean }) => Promise<{ data: VoiceCatalogOption[] | null; error: { message: string } | null }>;
        };
      };
    })
    .select("id, customer_category, label, persona, provider, provider_voice_id, provider_preview_url, local_preview_url, preview_source, description, verified_active, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    return { voices: toLegacyFallback(), source: "legacy" };
  }

  const normalized = data.map((row) => ({
    ...row,
    preview_url: row.preview_source === "provider" ? (row as { provider_preview_url?: string | null }).provider_preview_url ?? null : (row as { local_preview_url?: string | null }).local_preview_url ?? null,
  }));

  return { voices: normalized, source: "catalog" };
}

export function selectionFromOption(option: VoiceCatalogOption): VoiceSelection {
  return {
    selected_voice_catalog_id: option.id.startsWith("legacy-") ? null : option.id,
    voice_provider: option.provider,
    voice_provider_voice_id: option.provider_voice_id,
    voice_id: option.provider_voice_id,
    voice_label: option.label,
  };
}
