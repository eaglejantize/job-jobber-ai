import type { VoiceSyncStatus } from "./voice-resolution.ts";

type LogInput = {
  clientId: string;
  voiceCatalogId?: string | null;
  action: string;
  status: VoiceSyncStatus;
  voiceProvider?: string | null;
  providerVoiceId?: string | null;
  providerAgentId?: string | null;
  phoneNumberSnapshot?: string | null;
  errorMessage?: string | null;
  detail?: Record<string, unknown>;
};

export async function logVoiceSync(
  admin: { from: (table: string) => unknown },
  input: LogInput,
): Promise<void> {
  const detail = input.detail ?? {};

  await (admin.from("callcapture_voice_sync_log") as {
    insert: (payload: Record<string, unknown>) => Promise<unknown>;
  }).insert({
    client_id: input.clientId,
    voice_catalog_id: input.voiceCatalogId ?? null,
    action: input.action,
    status: input.status,
    voice_provider: input.voiceProvider ?? null,
    provider_voice_id: input.providerVoiceId ?? null,
    provider_agent_id: input.providerAgentId ?? null,
    phone_number_snapshot: input.phoneNumberSnapshot ?? null,
    error_message: input.errorMessage ?? null,
    detail,
  }).then(() => undefined, () => undefined);

  await (admin.from("callcapture_webhook_events") as {
    insert: (payload: Record<string, unknown>) => Promise<unknown>;
  }).insert({
    client_id: input.clientId,
    step: "voice_sync",
    status: input.status === "synced" ? "ok" : input.status === "pending" ? "skipped" : "error",
    detail: {
      action: input.action,
      voice_provider: input.voiceProvider ?? null,
      provider_voice_id: input.providerVoiceId ?? null,
      provider_agent_id: input.providerAgentId ?? null,
      phone_number_snapshot: input.phoneNumberSnapshot ?? null,
      error: input.errorMessage ?? null,
      ...detail,
    },
  }).then(() => undefined, () => undefined);
}
