import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Save, SkipForward, RotateCcw, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTIONS } from "./sections";
import { useConcierge } from "./useConcierge";
import SectionRenderer from "./SectionRenderer";
import ReviewAndApply from "./ReviewAndApply";
import PostApply from "./PostApply";
import { toast } from "@/hooks/use-toast";
import { ProgressPanel } from "@/onboarding/ProgressTracker";

export default function ConciergePage() {
  const navigate = useNavigate();
  const ctx = useConcierge();
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    // hydrate step into local state after load
  }, []);

  if (ctx.loading) {
    return <div className="container py-20 text-muted-foreground">Loading…</div>;
  }

  if (applied) {
    return (
      <div className="container py-10 max-w-2xl">
        <PostApply clientId={ctx.clientId} />
      </div>
    );
  }

  const section = SECTIONS[ctx.step];
  const isReview = section.id === "review";
  const pct = ((ctx.step + 1) / SECTIONS.length) * 100;

  async function next() {
    await ctx.persist({ step: Math.min(SECTIONS.length - 1, ctx.step + 1) });
    ctx.setStep(Math.min(SECTIONS.length - 1, ctx.step + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function prev() {
    ctx.setStep(Math.max(0, ctx.step - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function skip() {
    ctx.skipSection(section.id);
    await next();
  }
  async function saveAndExit() {
    await ctx.persist();
    toast({ title: "Progress saved", description: "You can pick up where you left off." });
    navigate("/settings");
  }
  async function restart() {
    if (!confirm("Restart the concierge? Your in-progress suggestions will be cleared.")) return;
    await ctx.reset();
    toast({ title: "Concierge reset" });
  }
  function exitNoSave() {
    if (!confirm("Exit without saving your in-progress suggestions?")) return;
    navigate("/settings");
  }

  return (
    <div className="container py-6 md:py-10 max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              AI Setup Concierge
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
            {section.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{section.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={saveAndExit} type="button">
            <Save className="h-4 w-4" /> Save & continue later
          </Button>
          <Button variant="ghost" size="sm" onClick={exitNoSave} type="button">
            <X className="h-4 w-4" /> Exit
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>
            Step {ctx.step + 1} of {SECTIONS.length}
          </span>
          <button onClick={restart} className="hover:text-foreground inline-flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> Restart
          </button>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <nav className="hidden md:block">
          <ProgressPanel compact className="mb-4" />
          <ol className="space-y-1 text-sm">
            {SECTIONS.map((s, i) => {
              const active = i === ctx.step;
              const done = i < ctx.step;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => ctx.setStep(i)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 rounded-md transition-colors",
                      active && "bg-primary text-primary-foreground",
                      !active && done && "text-foreground hover:bg-secondary",
                      !active && !done && "text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {i + 1}. {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
          {isReview ? (
            <ReviewAndApply ctx={ctx} onApplied={() => setApplied(true)} />
          ) : (
            <SectionRenderer sectionId={section.id} ctx={ctx} />
          )}

          {!isReview && (
            <div className="flex justify-between mt-6 pt-4 border-t border-border">
              <Button variant="ghost" onClick={prev} disabled={ctx.step === 0} type="button">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={skip} type="button">
                  <SkipForward className="h-4 w-4" /> Skip
                </Button>
                <Button onClick={next} className="bg-cta hover:opacity-90" type="button">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
