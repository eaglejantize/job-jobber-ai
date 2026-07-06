import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { deriveOnboardingState, isReadyToActivate } from "@/onboarding/status";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Redirects signed-in users to /setup until their onboarding is complete.
 * "Complete" = `onboarding_completed_at` is set, OR (for legacy accounts)
 * `launched_at` is set.
 */
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<"loading" | "complete" | "incomplete">("loading");

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("callcapture_clients")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      const row = data as Tables<"callcapture_clients"> | null;
      const normalized = deriveOnboardingState(row, row?.onboarding_state ?? null);
      const ready = isReadyToActivate(normalized).ready;
      const activated = normalized.activated_at && ready;

      // Super admins always pass; treat legacy launched accounts as complete too.
      if (!row || row.is_super_admin || activated || (ready && (row.onboarding_completed_at || row.launched_at))) {
        setState("complete");
      } else {
        setState("incomplete");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  if (authLoading || state === "loading") {
    return <div className="container py-20 text-sm text-muted-foreground">Loading…</div>;
  }

  if (state === "incomplete") {
    // The wizard IS the onboarding — never redirect while already on it.
    if (location.pathname.startsWith("/settings")) {
      return <>{children}</>;
    }
    return <Navigate to="/settings" replace />;
  }

  return <>{children}</>;
}
