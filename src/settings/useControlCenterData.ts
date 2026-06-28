import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ClientData = Record<string, any> & { id?: string };

export function useControlCenterData() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [data, setData] = useState<ClientData>({});

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
      setClientId((row as ClientData).id ?? null);
      setData(row as ClientData);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback((patch: Partial<ClientData>) => {
    setData((d) => ({ ...d, ...patch }));
  }, []);

  const save = useCallback(
    async (patch: Partial<ClientData>) => {
      if (!clientId) return { error: new Error("No client record") };
      setSaving(true);
      const { error } = await supabase
        .from("callcapture_clients")
        .update(patch as never)
        .eq("id", clientId);
      setSaving(false);
      if (!error) setData((d) => ({ ...d, ...patch }));
      return { error };
    },
    [clientId],
  );

  return { loading, saving, clientId, data, update, save, reload: load };
}

export type UseControlCenterData = ReturnType<typeof useControlCenterData>;