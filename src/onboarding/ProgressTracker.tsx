import { Link } from "react-router-dom";
import { CheckCircle2, Circle, AlertCircle, MinusCircle, Loader2, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ITEM_LABELS, ITEM_ORDER, ItemStatus, REQUIRED_FOR_ACTIVATION } from "./status";
import { useOnboardingState } from "./useOnboardingState";

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "complete")
    return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "in_progress")
    return <Loader2 className="h-4 w-4 text-amber-500 shrink-0" />;
  if (status === "needs_attention")
    return <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />;
  if (status === "skipped")
    return <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function statusLabel(s: ItemStatus): string {
  switch (s) {
    case "complete": return "Complete";
    case "in_progress": return "In progress";
    case "needs_attention": return "Needs attention";
    case "skipped": return "Skipped";
    default: return "Not started";
  }
}

export function ProgressPill() {
  const { loading, state, summary } = useOnboardingState();
  if (loading || state.activated_at) return null;
  return (
    <Link
      to="/settings/concierge"
      className="hidden sm:inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Setup {summary.complete}/{summary.total} · Resume
    </Link>
  );
}

export function ProgressPanel({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { loading, state, summary } = useOnboardingState();
  if (loading) return null;
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="font-semibold">Overall Setup Progress</div>
          <div className="text-xs text-muted-foreground">
            {summary.complete} of {summary.total} complete · {summary.pct}%
          </div>
        </div>
        <Button asChild size="sm" className="bg-cta hover:opacity-90">
          <Link to="/settings/concierge">
            <Sparkles className="h-4 w-4" /> Continue setup
          </Link>
        </Button>
      </div>
      <Progress value={summary.pct} className="h-2 mb-4" />
      {!compact && (
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {ITEM_ORDER.map((id) => {
            const item = state.items[id];
            const status = item?.status ?? "not_started";
            const required = REQUIRED_FOR_ACTIVATION.includes(id);
            return (
              <li key={id} className="flex items-center justify-between gap-2 py-0.5">
                <span className="flex items-center gap-2 min-w-0">
                  <StatusIcon status={status} />
                  <span className="truncate">
                    {ITEM_LABELS[id]}
                    {required && (
                      <span className="text-[10px] text-muted-foreground ml-1">·required</span>
                    )}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {statusLabel(status)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}