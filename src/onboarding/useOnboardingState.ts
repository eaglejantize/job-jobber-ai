import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  deriveOnboardingState,
  ItemId,
  ItemStatus,
  OnboardingState,
  ONBOARDING_STATE_SCHEMA_VERSION,
  progressSummary,
  isReadyToActivate,
} from "./status";

type ClientRow = Tables<"callcapture_clients">;

function statesEqual(a: OnboardingState | null | undefined, b: OnboardingState) {
  if (!a) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useOnboardingState() {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [client, setClient] = useState<ClientRow | null>(null);
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
      setClientId(row.id);
      setClient(row);
      const saved = (row.onboarding_state ?? null) as OnboardingState | null;
      const normalized = deriveOnboardingState(
        row as unknown as Record<string, unknown>,
        saved,
      );
      setState(normalized);
      if (!statesEqual(saved, normalized)) {
        await supabase
          .from("callcapture_clients")
          .update({ onboarding_state: normalized as unknown as Json })
          .eq("id", row.id);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onReload = () => void load();
    window.addEventListener("setup:reload", onReload);
    return () => window.removeEventListener("setup:reload", onReload);
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
        .update({ onboarding_state: next as unknown as Json })
        .eq("id", clientId);
    },
    [clientId, state],
  );

  const activate = useCallback(async () => {
    if (!clientId) return false;
    const { data: latest } = await supabase
      .from("callcapture_clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();
    const latestState = deriveOnboardingState(
      (latest ?? client) as unknown as Record<string, unknown>,
      state,
    );
    setClient((latest as ClientRow | null) ?? client);
    setState(latestState);
    const readiness = isReadyToActivate(latestState);
    if (!readiness.ready) return false;
    const next: OnboardingState = {
      ...latestState,
      schema_version: ONBOARDING_STATE_SCHEMA_VERSION,
      activated_at: new Date().toISOString(),
    };
    setState(next);
    await supabase
      .from("callcapture_clients")
      .update({
        onboarding_state: next as unknown as Json,
        launched_at: new Date().toISOString(),
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", clientId);
    return true;
  }, [clientId, client, state]);

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