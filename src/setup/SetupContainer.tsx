import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

const STEP_COMPONENTS = [
  Step1FindBusiness,
  Step2BusinessDetails,
  Step3PhoneNumber,
  Step4Voice,
  Step5Script,
  Step6CallHandling,
  Step7Notifications,
  Step8Review,
];

export default function SetupContainer() {
  const navigate = useNavigate();
  const { loading, data, update, save, clientId, setupStep } = useSetupData();
  const [step, setStep] = useState<number>(setupStep || 0);
  const [launched, setLaunched] = useState(false);
  const [launching, setLaunching] = useState(false);

  if (loading) {
    return (
      <div className="container py-20 text-muted-foreground">Loading…</div>
    );
  }

  const StepComp = STEP_COMPONENTS[step];
  const isLast = step === STEPS.length - 1;

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
        await supabase
          .from("callcapture_clients")
          .update({ launched_at: new Date().toISOString() } as never)
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
        {/* @ts-expect-error onEdit is only consumed by Step8Review */}
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
          <Button
            onClick={next}
            className="bg-cta hover:opacity-90"
            type="button"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
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
