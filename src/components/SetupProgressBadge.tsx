import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingState } from "@/onboarding/useOnboardingState";

// Thin wrappers that delegate to the unified onboarding tracker.
export function SetupProgressPill() {
  const { loading, state, summary } = useOnboardingState();
  if (loading || state.activated_at) return null;
  return (
    <Link
      to="/settings/concierge"
      className="hidden sm:inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Setup {summary.pct}% · Resume
    </Link>
  );
}

export function SetupProgressBanner() {
  const { loading, state, summary } = useOnboardingState();
  if (loading || state.activated_at) return null;
  return (
    <div className="container pt-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <div className="text-sm">
          <div className="font-medium">Finish setting up your AI receptionist</div>
          <div className="text-xs text-muted-foreground">
            {summary.pct}% complete — {summary.complete}/{summary.total} items.
          </div>
        </div>
        <Button asChild size="sm">
          <Link to="/settings/concierge">Resume setup</Link>
        </Button>
      </div>
    </div>
  );
}