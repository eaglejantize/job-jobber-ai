import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (authLoading) return;
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("callcapture_clients")
        .select("is_super_admin")
        .or(`user_id.eq.${user.id},email.eq.${user.email ?? ""}`)
        .eq("is_super_admin", true)
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setIsAdmin(!error && !!data?.is_super_admin);
        setLoading(false);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
}