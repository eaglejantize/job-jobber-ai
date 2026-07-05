import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Rocket, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { FIELD_LABELS } from "./sections";
import type { UseConcierge } from "./useConcierge";
import { useOnboardingState } from "@/onboarding/useOnboardingState";
import { ITEM_LABELS, REQUIRED_FOR_ACTIVATION, SKIPPABLE_FOR_ACTIVATION } from "@/onboarding/status";
import { ProgressPanel } from "@/onboarding/ProgressTracker";

function display(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    if (typeof v[0] === "string") return (v as string[]).join(", ");
    if (typeof v[0] === "object") {
      return (v as Array<Record<string, unknown>>)
        .map((o) => {
          if ("q" in o && "a" in o) return `Q: ${o.q} — A: ${o.a}`;
          return JSON.stringify(o);
        })
        .join(" • ");
    }
  }
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export default function ReviewAndApply({
  ctx,
  onApplied,
}: {
  ctx: UseConcierge;
  onApplied: () => void;
}) {
  const onboarding = useOnboardingState();
  const rows = useMemo(() => {
    return Object.keys(ctx.pending).map((key) => ({
      key,
      label: FIELD_LABELS[key] || key,
      currentValue: (ctx.current as any)?.[key],
      proposedValue: (ctx.pending as any)[key],
    }));
  }, [ctx.pending, ctx.current]);

  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries(rows.map((r) => [r.key, true])),
  );
  const [applying, setApplying] = useState(false);

  const toggle = (k: string) => setSelected((s) => ({ ...s, [k]: !s[k] }));

  async function doApply(all: boolean) {
    const fields = all
      ? rows.map((r) => r.key)
      : rows.filter((r) => selected[r.key]).map((r) => r.key);
    if (fields.length === 0) {
      toast({ title: "Nothing selected" });
      return;
    }
    setApplying(true);
    const { error } = await ctx.apply(fields);
    setApplying(false);
    if (error) {
      toast({ title: "Couldn't apply", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Settings updated" });
    await onboarding.reload();
    onApplied();
  }

  async function activate() {
    if (!onboarding.readiness.ready) {
      toast({
        title: "Setup is not ready",
        description: "Complete every required item before activating your AI receptionist.",
        variant: "destructive",
      });
      return;
    }
    // Apply any remaining pending changes first
    if (rows.length > 0) {
      await ctx.apply(rows.map((r) => r.key));
    }
    await onboarding.reload();
    if (!onboarding.readiness.ready) {
      toast({
        title: "Setup is not ready",
        description: "Phone routing must be configured before activation.",
        variant: "destructive",
      });
      return;
    }
    await onboarding.activate();
    toast({ title: "AI receptionist activated" });
    onApplied();
  }

  return (
    <div className="space-y-4">
      <ProgressPanel />

      {rows.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 p-2"></th>
              <th className="text-left p-2">Field</th>
              <th className="text-left p-2">Current</th>
              <th className="text-left p-2">Suggested</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border align-top">
                <td className="p-2">
                  <Checkbox
                    checked={!!selected[r.key]}
                    onCheckedChange={() => toggle(r.key)}
                  />
                </td>
                <td className="p-2 font-medium">{r.label}</td>
                <td className="p-2 text-muted-foreground max-w-[260px] break-words">
                  {display(r.currentValue)}
                </td>
                <td className="p-2 max-w-[320px] break-words">{display(r.proposedValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => doApply(false)} disabled={applying} type="button">
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
          Apply selected
        </Button>
        <Button onClick={() => doApply(true)} disabled={applying} className="bg-cta hover:opacity-90" type="button">
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
          Apply all
        </Button>
        </div>
      )}

      <div className="rounded-xl border border-border p-4">
        <div className="font-semibold mb-2 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" /> Activation checklist
        </div>
        <ul className="text-sm space-y-1 mb-4">
          {REQUIRED_FOR_ACTIVATION.map((id) => {
            const status = onboarding.state.items[id]?.status;
            const skipped =
              status === "skipped" && SKIPPABLE_FOR_ACTIVATION.includes(id);
            const done = status === "complete" || skipped;
            return (
              <li key={id} className="flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span className={done ? "" : "text-muted-foreground"}>
                  {ITEM_LABELS[id]}
                  {skipped && (
                    <span className="ml-2 text-xs text-muted-foreground">(skipped)</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <Button
          onClick={activate}
          disabled={!onboarding.readiness.ready || applying}
          className="w-full bg-cta hover:opacity-90 text-base py-6"
          type="button"
        >
          <Rocket className="h-5 w-5" />
          ACTIVATE MY AI RECEPTIONIST
        </Button>
        {!onboarding.readiness.ready && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Complete the required items above to activate.
          </p>
        )}
      </div>
    </div>
  );
}