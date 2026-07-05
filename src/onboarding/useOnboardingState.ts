import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  deriveOnboardingState,
  ItemId,
  ItemStatus,
  OnboardingState,
  ONBOARDING_STATE_SCHEMA_VERSION,
  progressSummary,
  isReadyToActivate,
} from "./status";

function statesEqual(a: OnboardingState | null | undefined, b: OnboardingState) {
  if (!a) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useOnboardingState() {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [client, setClient] = useState<Record<string, any> | null>(null);
  const [state, setState] = useState<OnboardingState>({ items: {}, activated_at: null });

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
      setClient(row);
      const saved = ((row as any).onboarding_state ?? null) as OnboardingState | null;
      const normalized = deriveOnboardingState(row, saved);
      setState(normalized);
      if (!statesEqual(saved, normalized)) {
        await supabase
          .from("callcapture_clients")
          .update({ onboarding_state: normalized } as never)
          .eq("id", (row as any).id);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markStatus = useCallback(
    async (id: ItemId, status: ItemStatus) => {
      if (!clientId) return;
      const next: OnboardingState = {
        ...state,
        schema_version: ONBOARDING_STATE_SCHEMA_VERSION,
        items: { ...state.items, [id]: { status, updated_at: new Date().toISOString() } },
      };
      setState(next);
      await supabase
        .from("callcapture_clients")
        .update({ onboarding_state: next } as never)
        .eq("id", clientId);
    },
    [clientId, state],
  );

  const activate = useCallback(async () => {
    if (!clientId) return;
    const readiness = isReadyToActivate(state);
    if (!readiness.ready) return;
    const next: OnboardingState = {
      ...state,
      schema_version: ONBOARDING_STATE_SCHEMA_VERSION,
      activated_at: new Date().toISOString(),
    };
    setState(next);
    await supabase
      .from("callcapture_clients")
      .update({
        onboarding_state: next,
        launched_at: new Date().toISOString(),
        onboarding_completed_at: new Date().toISOString(),
      } as never)
      .eq("id", clientId);
  }, [clientId, state]);

  return {
    loading,
    clientId,
    client,
    state,
    summary: progressSummary(state),
    readiness: isReadyToActivate(state),
    markStatus,
    activate,
    reload: load,
  };
}

export type UseOnboardingState = ReturnType<typeof useOnboardingState>;