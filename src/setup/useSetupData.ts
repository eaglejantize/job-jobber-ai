import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  emptySetupData,
  SetupData,
  SetupDataSchema,
  DayHours,
  DAYS,
} from "./schema";

type ClientRow = Record<string, unknown> & { id: string; user_id: string | null };

function rowToData(row: ClientRow | null): SetupData {
  const base = emptySetupData();
  if (!row) return base;
  const merged: SetupData = {
    ...base,
    google_place_id: (row.google_place_id as string) ?? "",
    google_rating: (row.google_rating as number) ?? null,
    google_category: (row.google_category as string) ?? "",
    business_name: (row.business_name as string) ?? "",
    owner_name: (row.owner_name as string) ?? "",
    business_phone: (row.business_phone as string) ?? "",
    address: (row.address as string) ?? "",
    industry: (row.industry as string) ?? "",
    website: (row.website as string) ?? "",
    business_hours_schedule:
      (row.business_hours_schedule as Record<string, DayHours>) ?? base.business_hours_schedule,
    timezone: (row.timezone as string) ?? base.timezone,
    preferred_area_code: (row.preferred_area_code as string) ?? "",
    assigned_callcapture_number: (row.assigned_callcapture_number as string) ?? null,
    number_status: (row.number_status as string) ?? null,
    voice_id: (row.voice_id as string) ?? "",
    voice_label: (row.voice_label as string) ?? "",
    tone: ((row.tone as SetupData["tone"]) ?? "Friendly"),
    voice_speed: ((row.voice_speed as SetupData["voice_speed"]) ?? "normal"),
    rings_before_answer: (row.rings_before_answer as number) ?? 2,
    greeting: (row.greeting as string) ?? "",
    after_hours_message: (row.after_hours_message as string) ?? "",
    services: (row.services as string[]) ?? [],
    faqs: (row.faqs as SetupData["faqs"]) ?? [],
    forward_phone: (row.forward_phone as string) ?? "",
    voicemail_fallback: (row.voicemail_fallback as boolean) ?? true,
    after_hours_mode:
      ((row.after_hours_mode as SetupData["after_hours_mode"]) ?? "voicemail"),
    notification_settings:
      (row.notification_settings as SetupData["notification_settings"]) ??
      base.notification_settings,
  };
  // ensure days exist
  const hours = { ...merged.business_hours_schedule };
  for (const d of DAYS) {
    if (!hours[d]) hours[d] = { open: "09:00", close: "17:00", closed: d === "Sun" };
  }
  merged.business_hours_schedule = hours;
  return SetupDataSchema.parse(merged);
}

export type UseSetupData = ReturnType<typeof useSetupData>;

export function useSetupData() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [data, setData] = useState<SetupData>(emptySetupData);
  const [setupStep, setSetupStepLocal] = useState<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    const { data: row } = await supabase
      .from("callcapture_clients")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row) {
      setClientId((row as ClientRow).id);
      setData(rowToData(row as ClientRow));
      setSetupStepLocal(((row as ClientRow).setup_step as number) ?? 0);
    } else {
      setData(emptySetupData());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback((patch: Partial<SetupData>) => {
    setData((d) => ({ ...d, ...patch }));
  }, []);

  const save = useCallback(
    async (patch: Partial<SetupData> & { setup_step?: number }) => {
      if (!clientId) return { error: new Error("No client record") };
      setSaving(true);
      const { setup_step, ...rest } = patch;
      const payload: Record<string, unknown> = { ...rest };
      if (typeof setup_step === "number") payload.setup_step = setup_step;
      const { error } = await supabase
        .from("callcapture_clients")
        .update(payload as never)
        .eq("id", clientId);
      setSaving(false);
      if (!error) {
        setData((d) => ({ ...d, ...rest }));
        if (typeof setup_step === "number") setSetupStepLocal(setup_step);
      }
      return { error };
    },
    [clientId],
  );

  return {
    loading,
    saving,
    clientId,
    data,
    setupStep,
    update,
    save,
    reload: load,
  };
}
