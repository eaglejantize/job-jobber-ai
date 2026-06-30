import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Rocket } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { STEPS } from "./schema";
import { useSetupData } from "./useSetupData";
import {
  Step1FindBusiness,
  Step2BusinessDetails,
  Step3PhoneNumber,
  Step4Voice,
  Step5Script,
  Step6CallHandling,
  Step7Notifications,
  Step8Review,
} from "./steps";
import { StepWelcome, StepCrm, StepTestCall, StepGoLive } from "./extraSteps";

const STEP_COMPONENTS = [
  StepWelcome,
  Step1FindBusiness,
  Step2BusinessDetails,
  Step3PhoneNumber,
  Step4Voice,
  Step5Script,
  Step6CallHandling,
  Step7Notifications,
  StepCrm,
  StepTestCall,
  StepGoLive,
];

export default function SetupContainer() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loading, data, update, save, clientId, setupStep, reload } = useSetupData();
  const [step, setStep] = useState<number>(0);
  const [launched, setLaunched] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (loading) return;
    const fromUrl = parseInt(params.get("step") || "", 10);
    if (!Number.isNaN(fromUrl) && fromUrl >= 0 && fromUrl < STEPS.length) {
      setStep(fromUrl);
    } else {
      setStep(Math.min(STEPS.length - 1, setupStep || 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    const handler = () => {
      reload();
    };
    window.addEventListener("setup:reload", handler);
    return () => window.removeEventListener("setup:reload", handler);
  }, [reload]);

  if (loading) {
    return (
      <div className="container py-20 text-muted-foreground">Loading…</div>
    );
  }

  const StepComp = STEP_COMPONENTS[step];
  const isLast = step === STEPS.length - 1;

  // Block Next on the phone step until a number is assigned/linked.
  const PHONE_STEP_INDEX = 3;
  const nextBlockedReason: string | null =
    step === PHONE_STEP_INDEX && !data.assigned_callcapture_number
      ? "Choose, link, or test a number before continuing."
      : null;

  async function next() {
    await save({ ...data, setup_step: Math.min(STEPS.length - 1, step + 1) });
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function launch() {
    setLaunching(true);
    try {
      await save({ ...data, setup_step: STEPS.length - 1 });
      if (clientId) {
        const nowIso = new Date().toISOString();
        await supabase
          .from("callcapture_clients")
          .update({ launched_at: nowIso, onboarding_completed_at: nowIso } as never)
          .eq("id", clientId);
        try {
          await supabase.functions.invoke("update-vapi-agent", {
            body: { client_id: clientId },
          });
        } catch {
          /* non-fatal */
        }
      }
      setLaunched(true);
    } catch (e) {
      toast({
        title: "Couldn't launch",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  }

  if (launched) {
    return (
      <div className="container py-16 max-w-xl text-center">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-2xl font-bold mt-4">
          Your AI receptionist is live!
        </h1>
        <p className="text-muted-foreground mt-2">
          Customers can now reach you at{" "}
          <strong>{data.assigned_callcapture_number || "your Vektuor number"}</strong>.
          Test it by calling that number now.
        </p>
        <Button
          className="mt-6 bg-cta hover:opacity-90"
          onClick={() => navigate("/dashboard")}
        >
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8 md:py-12 max-w-2xl">
      <div className="text-center mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {STEPS[step].title}
        </h1>
        <Progress
          value={((step + 1) / STEPS.length) * 100}
          className="mt-4 h-2"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-card-soft">
        <StepComp
          data={data}
          update={update}
          save={save}
          clientId={clientId}
          mode="wizard"
          onEdit={(s: number) => setStep(s - 1)}
        />
      </div>

      <div className="flex justify-between mt-6">
        <Button
          variant="ghost"
          onClick={prev}
          disabled={step === 0}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {!isLast ? (
          <div className="flex flex-col items-end gap-1">
            <Button
              onClick={next}
              className="bg-cta hover:opacity-90"
              type="button"
              disabled={!!nextBlockedReason}
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
            {nextBlockedReason && (
              <span className="text-xs text-muted-foreground">{nextBlockedReason}</span>
            )}
          </div>
        ) : (
          <Button
            onClick={launch}
            className="bg-cta hover:opacity-90"
            disabled={launching}
            type="button"
          >
            {launching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            Launch My AI Receptionist
          </Button>
        )}
      </div>
    </div>
  );
}
