import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { STEPS } from "@/setup/schema";
import { Button } from "@/components/ui/button";

type Row = {
  setup_step: number | null;
  onboarding_completed_at: string | null;
  launched_at: string | null;
};

function useSetupStatus() {
  const { user } = useAuth();
  const [row, setRow] = useState<Row | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("callcapture_clients")
        .select("setup_step, onboarding_completed_at, launched_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setRow((data as Row) ?? null);
    })();
    return () => { cancelled = true; };
  }, [user]);
  if (!row) return null;
  const complete = !!(row.onboarding_completed_at || row.launched_at);
  const step = Math.min(STEPS.length - 1, Math.max(0, row.setup_step ?? 0));
  const pct = complete ? 100 : Math.round(((step) / (STEPS.length - 1)) * 100);
  return { complete, step, pct };
}

export function SetupProgressPill() {
  const status = useSetupStatus();
  if (!status || status.complete) return null;
  return (
    <Link
      to={`/setup?step=${status.step}`}
      className="hidden sm:inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Setup {status.pct}% · Resume
    </Link>
  );
}

export function SetupProgressBanner() {
  const status = useSetupStatus();
  if (!status || status.complete) return null;
  return (
    <div className="container pt-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <div className="text-sm">
          <div className="font-medium">Finish setting up your AI receptionist</div>
          <div className="text-xs text-muted-foreground">{status.pct}% complete — pick up where you left off.</div>
        </div>
        <Button asChild size="sm">
          <Link to={`/setup?step=${status.step}`}>Resume setup</Link>
        </Button>
      </div>
    </div>
  );
}