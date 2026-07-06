export type VoiceSyncStatus = "synced" | "failed" | "pending";

export type VoiceCatalogRow = {
  id: string;
  label: string;
  provider: string;
  provider_voice_id: string;
  provider_preview_url: string | null;
  local_preview_url: string | null;
  preview_source: "provider" | "local";
  is_active: boolean;
  verified_active: boolean;
};

export type ClientVoiceFields = {
  selected_voice_catalog_id?: string | null;
  voice_id?: string | null;
  voice_label?: string | null;
};

export type ResolvedVoice = {
  source: "catalog" | "legacy";
  selectedVoiceCatalogId: string | null;
  label: string;
  provider: string;
  providerVoiceId: string;
  previewUrl: string | null;
  isVerified: boolean;
  mismatch: boolean;
  mismatchReason: string | null;
};

const LEGACY_PLACEHOLDER_IDS = new Set([
  "maya",
  "jasmine",
  "claire",
  "marcus",
  "leo",
  "ava",
  "noah",
  "luna",
  "placeholder-maya",
  "placeholder-jasmine",
  "placeholder-claire",
  "placeholder-marcus",
  "placeholder-leo",
  "placeholder-ava",
  "placeholder-noah",
]);

function legacyVoice(client: ClientVoiceFields): ResolvedVoice {
  const legacyId = String(client.voice_id ?? "").trim();
  const legacyLabel = String(client.voice_label ?? "").trim() || "Default voice";

  if (!legacyId || LEGACY_PLACEHOLDER_IDS.has(legacyId) || legacyId.startsWith("placeholder-")) {
    return {
      source: "legacy",
      selectedVoiceCatalogId: null,
      label: legacyLabel,
      provider: "vapi",
      providerVoiceId: "Elliot",
      previewUrl: null,
      isVerified: false,
      mismatch: false,
      mismatchReason: null,
    };
  }

  return {
    source: "legacy",
    selectedVoiceCatalogId: null,
    label: legacyLabel,
    provider: "11labs",
    providerVoiceId: legacyId,
    previewUrl: null,
    isVerified: false,
    mismatch: false,
    mismatchReason: null,
  };
}

export async function resolveVoiceForClient(
  admin: { from: (table: string) => unknown },
  client: ClientVoiceFields,
): Promise<ResolvedVoice> {
  if (!client.selected_voice_catalog_id) return legacyVoice(client);

  const { data, error } = await (admin
    .from("callcapture_voice_catalog") as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: VoiceCatalogRow | null; error: { message: string } | null }>;
        };
      };
    })
    .select("id, label, provider, provider_voice_id, provider_preview_url, local_preview_url, preview_source, is_active, verified_active")
    .eq("id", client.selected_voice_catalog_id)
    .maybeSingle();

  if (error || !data) {
    const fallback = legacyVoice(client);
    return {
      ...fallback,
      mismatch: true,
      mismatchReason: error?.message ?? "Selected voice catalog row was not found",
    };
  }

  if (!data.is_active) {
    const fallback = legacyVoice(client);
    return {
      ...fallback,
      mismatch: true,
      mismatchReason: "Selected voice is inactive",
    };
  }

  return {
    source: "catalog",
    selectedVoiceCatalogId: data.id,
    label: data.label,
    provider: data.provider,
    providerVoiceId: data.provider_voice_id,
    previewUrl: data.preview_source === "provider" ? data.provider_preview_url : data.local_preview_url,
    isVerified: data.verified_active,
    mismatch: !data.verified_active,
    mismatchReason: data.verified_active ? null : "Selected voice is not verified active",
  };
}
