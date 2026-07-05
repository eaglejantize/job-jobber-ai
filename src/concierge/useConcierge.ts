import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SECTIONS } from "./sections";

export type PendingMap = Record<string, unknown>;

export type ConciergePersisted = {
  step: number;
  pending: PendingMap;
  skipped: string[];
  updated_at?: string;
  schema_version?: number;
};

const CONCIERGE_STATE_SCHEMA_VERSION = 2;
const PHONE_NUMBER_STEP_INDEX = SECTIONS.findIndex((s) => s.id === "phone_number");

function normalizeConciergeState(saved: ConciergePersisted): ConciergePersisted {
  const rawStep = Number.isFinite(Number(saved.step)) ? Number(saved.step) : 0;
  const oldFlow = saved.schema_version !== CONCIERGE_STATE_SCHEMA_VERSION;
  const shiftedStep = oldFlow && rawStep >= PHONE_NUMBER_STEP_INDEX ? rawStep + 1 : rawStep;
  const step = Math.min(SECTIONS.length - 1, Math.max(0, shiftedStep));

  return {
    step,
    pending: saved.pending && typeof saved.pending === "object" ? saved.pending : {},
    skipped: Array.isArray(saved.skipped)
      ? saved.skipped.filter((id) => id !== "phone_number")
      : [],
    updated_at: saved.updated_at,
    schema_version: CONCIERGE_STATE_SCHEMA_VERSION,
  };
}

function needsPhoneNumberStep(row: Record<string, any>) {
  return !row?.is_super_admin && !row?.assigned_callcapture_number;
}

function conciergeStatesEqual(a: ConciergePersisted | null | undefined, b: ConciergePersisted) {
  if (!a) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useConcierge() {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [current, setCurrent] = useState<Record<string, any>>({});
  const [pending, setPending] = useState<PendingMap>({});
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState<string[]>([]);

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
      setClientId((row as any).id);
      setCurrent(row as Record<string, any>);
      const saved = (row as any).concierge_state as ConciergePersisted | null;
      if (saved && typeof saved === "object") {
        const normalized = normalizeConciergeState(saved);
        const forcedPhoneStep = needsPhoneNumberStep(row as Record<string, any>);
        const nextStep = forcedPhoneStep ? PHONE_NUMBER_STEP_INDEX : normalized.step;
        const persisted = forcedPhoneStep ? { ...normalized, step: nextStep } : normalized;
        setPending(normalized.pending || {});
        setStep(nextStep);
        setSkipped(normalized.skipped || []);
        if (!conciergeStatesEqual(saved, persisted)) {
          await supabase
            .from("callcapture_clients")
            .update({ concierge_state: persisted } as never)
            .eq("id", (row as any).id);
        }
      } else if (needsPhoneNumberStep(row as Record<string, any>)) {
        const initial: ConciergePersisted = {
          step: PHONE_NUMBER_STEP_INDEX,
          pending: {},
          skipped: [],
          schema_version: CONCIERGE_STATE_SCHEMA_VERSION,
          updated_at: new Date().toISOString(),
        };
        setStep(PHONE_NUMBER_STEP_INDEX);
        await supabase
          .from("callcapture_clients")
          .update({ concierge_state: initial } as never)
          .eq("id", (row as any).id);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = useCallback((key: string, value: unknown) => {
    setPending((p) => ({ ...p, [key]: value }));
  }, []);

  const persist = useCallback(
    async (override?: Partial<ConciergePersisted>) => {
      if (!clientId) return;
      const payload: ConciergePersisted = {
        step,
        pending,
        skipped,
        ...override,
        schema_version: CONCIERGE_STATE_SCHEMA_VERSION,
        updated_at: new Date().toISOString(),
      };
      await supabase
        .from("callcapture_clients")
        .update({ concierge_state: payload } as never)
        .eq("id", clientId);
    },
    [clientId, step, pending, skipped],
  );

  const reset = useCallback(async () => {
    setPending({});
    setSkipped([]);
    setStep(0);
    if (clientId) {
      await supabase
        .from("callcapture_clients")
        .update({ concierge_state: null } as never)
        .eq("id", clientId);
    }
  }, [clientId]);

  const skipSection = useCallback(
    (id: string) => {
      setSkipped((s) => (s.includes(id) ? s : [...s, id]));
    },
    [],
  );

  const apply = useCallback(
    async (fieldsToApply: string[]) => {
      if (!clientId) return { error: new Error("No client") };
      const patch: Record<string, unknown> = {};
      for (const f of fieldsToApply) {
        if (f in pending) patch[f] = pending[f];
      }
      if (Object.keys(patch).length === 0) return { error: null };
      const { error } = await supabase
        .from("callcapture_clients")
        .update({ ...patch, concierge_state: null } as never)
        .eq("id", clientId);
      return { error };
    },
    [clientId, pending],
  );

  // Apply the given fields to the client row without discarding remaining
  // pending suggestions. Used by the per-step "Apply Changes" button.
  const applyFields = useCallback(
    async (fieldsToApply: string[]) => {
      if (!clientId) return { error: new Error("No client") };
      const patch: Record<string, unknown> = {};
      for (const f of fieldsToApply) {
        if (f in pending) patch[f] = pending[f];
      }
      if (Object.keys(patch).length === 0) return { error: null };
      const { error } = await supabase
        .from("callcapture_clients")
        .update(patch as never)
        .eq("id", clientId);
      if (!error) {
        setPending((p) => {
          const next = { ...p };
          for (const f of fieldsToApply) delete next[f];
          return next;
        });
        setCurrent((c) => ({ ...c, ...patch }));
      }
      return { error };
    },
    [clientId, pending],
  );

  return {
    loading,
    clientId,
    current,
    pending,
    step,
    skipped,
    setStep,
    setField,
    setPending,
    persist,
    reset,
    skipSection,
    apply,
    applyFields,
    reload: load,
  };
}

export type UseConcierge = ReturnType<typeof useConcierge>;