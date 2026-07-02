import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SECTIONS } from "./sections";

export type PendingMap = Record<string, unknown>;

export type ConciergePersisted = {
  step: number;
  pending: PendingMap;
  skipped: string[];
  updated_at?: string;
};

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
        setPending(saved.pending || {});
        setStep(Math.min(SECTIONS.length - 1, Math.max(0, saved.step || 0)));
        setSkipped(saved.skipped || []);
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