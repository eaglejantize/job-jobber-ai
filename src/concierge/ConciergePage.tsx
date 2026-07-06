import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Save, SkipForward, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ensurePhoneNumberSection, SECTIONS } from "./sections";
import { useConcierge } from "./useConcierge";
import SectionRenderer from "./SectionRenderer";
import ReviewAndApply from "./ReviewAndApply";
import PostApply from "./PostApply";
import { toast } from "@/hooks/use-toast";
import { useOnboardingState } from "@/onboarding/useOnboardingState";
import { REQUIRED_FOR_ACTIVATION, SKIPPABLE_FOR_ACTIVATION, type ItemId } from "@/onboarding/status";

const SECTION_TO_ITEM: Record<string, ItemId> = {
  business_profile: "business_info",
  services: "services",
  hours: "hours",
  phone_number: "phone_number",
  website_import: "website_import",
  knowledge: "knowledge_base",
  ai_receptionist: "ai_receptionist",
  integrations: "integrations",
  test_call: "test_call",
};

export default function ConciergePage() {
  const navigate = useNavigate();
  const ctx = useConcierge();
  const onboarding = useOnboardingState();
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const sections = ensurePhoneNumberSection(SECTIONS);

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

  const safeStep = Math.min(sections.length - 1, Math.max(0, ctx.step));
  const section = sections[safeStep];
  const isReview = section.id === "review";
  const pct = ((safeStep + 1) / sections.length) * 100;
  const phoneMissing = !ctx.current?.assigned_callcapture_number;
  const isPhoneStep = section.id === "phone_number";
  const mustCompletePhone = isPhoneStep && phoneMissing;

  async function next() {
    if (mustCompletePhone) {
      toast({
        title: "Choose a business phone number",
        description: "Select a new number, link an existing number, forward your line, or use a test number before continuing.",
        variant: "destructive",
      });
      return;
    }
    await ctx.persist({ step: Math.min(sections.length - 1, safeStep + 1) });
    ctx.setStep(Math.min(sections.length - 1, safeStep + 1));
  }
  function prev() {
    ctx.setStep(Math.max(0, safeStep - 1));
  }
  async function skip() {
    if (isPhoneStep) {
      toast({
        title: "Phone setup is required",
        description: "Every subscriber needs a business phone number before setup can continue.",
        variant: "destructive",
      });
      return;
    }
    const itemId = SECTION_TO_ITEM[section.id];
    const canPersistSkip =
      itemId &&
      (!REQUIRED_FOR_ACTIVATION.includes(itemId) || SKIPPABLE_FOR_ACTIVATION.includes(itemId));
    if (canPersistSkip) {
      ctx.skipSection(section.id);
      await onboarding.markStatus(itemId, "skipped");
    }
    await next();
  }
  async function saveAndExit() {
    await ctx.persist();
    toast({ title: "Progress saved", description: "You can pick up where you left off." });
    navigate("/dashboard");
  }
  async function applyChanges() {
    setApplying(true);
    const { error } = await ctx.applyFields(section.fields);
    setApplying(false);
    if (error) {
      toast({ title: "Couldn't save", description: (error as Error).message, variant: "destructive" });
    } else {
      toast({ title: "Changes applied" });
    }
  }
  async function restart() {
    if (!confirm("Restart setup? Your in-progress suggestions will be cleared.")) return;
    await ctx.reset();
    toast({ title: "Setup reset" });
  }

  return (
    <div className="container py-6 md:py-10 max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {section.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{section.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={saveAndExit} type="button">
            <Save className="h-4 w-4" /> Save & continue later
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>
            Step {safeStep + 1} of {sections.length}
          </span>
          <button onClick={restart} className="hover:text-foreground inline-flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> Restart
          </button>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <nav className="hidden md:block">
          <ol className="space-y-1 text-sm">
            {sections.map((s, i) => {
              const active = i === safeStep;
              const done = i < safeStep;
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
            <div className="flex flex-wrap justify-between gap-2 mt-6 pt-4 border-t border-border">
              <Button variant="ghost" onClick={prev} disabled={safeStep === 0} type="button">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={skip} type="button" disabled={isPhoneStep}>
                  <SkipForward className="h-4 w-4" />
                  {section.id === "test_call" ? "Skip — I'll test later" : "Skip"}
                </Button>
                <Button
                  variant="outline"
                  onClick={applyChanges}
                  type="button"
                  disabled={applying || section.fields.length === 0}
                >
                  <Check className="h-4 w-4" /> Apply changes
                </Button>
                <Button onClick={next} disabled={mustCompletePhone} className="bg-cta hover:opacity-90" type="button">
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