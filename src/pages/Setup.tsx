import Layout from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import {
  defaultWizardState,
  loadWizardState,
  saveWizardState,
  type WizardState,
} from "@/lib/wizardSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { INDUSTRIES, DEFAULT_INTAKE_QUESTIONS } from "@/lib/constants";
import RequestSetupBanner from "@/components/RequestSetupBanner";
import { generateAssistantPrompt } from "@/lib/generatePrompt";
import { ArrowRight, ArrowLeft, Plus, X, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const STEPS = [
  "Business Info",
  "Call Goals",
  "Info to Collect",
  "Tone",
  "Existing Customer Handling",
  "Generate Instructions",
] as const;

const CALL_GOALS = ["Capture leads", "Existing customers", "Info calls"] as const;
const TONE_OPTIONS = ["Friendly", "Direct", "Helpful"] as const;
const COLLECT_OPTIONS = ["Name", "Phone", "Issue", "Address", "Urgency"] as const;

export default function Setup() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>(loadWizardState);
  const [step, setStep] = useState(0);
  const [customQ, setCustomQ] = useState("");
  const [callGoals, setCallGoals] = useState<string[]>(["Capture leads"]);
  const [existingCustomerForward, setExistingCustomerForward] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { saveWizardState(state); }, [state]);

  // Prefill from the user's most recent client row, if signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      const { data } = await supabase
        .from("callcapture_clients")
        .select("id, owner_name, business_name, email, alert_phone")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setClientId(data.id);
      setState((s) => ({
        ...s,
        businessName: s.businessName || data.business_name || "",
        email: s.email || data.email || "",
        ownerName: s.ownerName || data.owner_name || "",
        ownerSms: s.ownerSms || data.alert_phone || "",
      }));
    })();
    return () => { cancelled = true; };
  }, []);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const generated = useMemo(
    () => generateAssistantPrompt({
      ...state,
      // Map wizard tone "Helpful" through generator (already in enum)
    }),
    [state],
  );

  function next() {
    if (step === 0 && (!state.businessName.trim() || !state.industry)) {
      toast({ title: "Add business type and name", variant: "destructive" });
      return;
    }
    if (step === 1 && callGoals.length === 0) {
      toast({ title: "Pick at least one call goal", variant: "destructive" });
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function prev() { setStep((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function generateAndFinish() {
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: biz, error: be } = await supabase
          .from("callcapture_businesses")
          .insert({
            user_id: u.user.id,
            business_name: state.businessName,
            industry: state.industry,
            phone: state.phone,
            email: state.email,
            service_area: state.serviceArea || null,
            business_hours: state.businessHours || null,
          })
          .select("id")
          .single();
        if (be || !biz) throw be ?? new Error("Couldn't save business");

        const { error: ce } = await supabase
          .from("callcapture_assistant_configs")
          .insert({
            business_id: biz.id,
            user_id: u.user.id,
            assistant_name: state.assistantName,
            greeting: state.greeting,
            tone: state.tone,
            after_hours_enabled: state.afterHoursEnabled,
            transfer_enabled: state.transferEnabled || existingCustomerForward,
            transfer_phone: state.transferPhone || null,
            intake_questions: state.intakeQuestions,
            call_rules: {
              transferTriggers: state.transferTriggers,
              fallbackAction: state.fallbackAction,
              callGoals,
              existingCustomerForward,
            },
            notification_settings: {
              ownerName: state.ownerName,
              ownerSms: state.ownerSms,
              ownerEmail: state.ownerEmail,
              sendSms: state.sendSms,
              sendEmail: state.sendEmail,
            },
            generated_prompt: generated,
          });
        if (ce) throw ce;
      }

      if (clientId) {
        await supabase
          .from("callcapture_clients")
          .update({ setup_status: "Live" })
          .eq("id", clientId);
      }

      toast({ title: "Your AI receptionist is ready." });
      navigate("/dashboard");
    } catch (err) {
      toast({
        title: "Couldn't finish setup",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <section className="bg-hero">
        <div className="container py-12 md:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Let's set up your AI receptionist
            </h1>
            <p className="mt-2 text-muted-foreground">We set this up for you. Live in 24 hours.</p>
            <Progress value={((step + 1) / STEPS.length) * 100} className="mt-6 h-2" />
          </div>
        </div>
      </section>

      <section className="container pb-20 grid lg:grid-cols-[1fr_320px] gap-8 -mt-4">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card-soft">
          <h2 className="text-xl font-semibold mb-6">{STEPS[step]}</h2>

          {step === 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Business name *" value={state.businessName} onChange={(v) => set("businessName", v)} />
              <SelectField label="Business type *" value={state.industry} onChange={(v) => set("industry", v)} options={INDUSTRIES} />
              <Field label="Service area" placeholder="e.g. Jacksonville + 30 mi" value={state.serviceArea ?? ""} onChange={(v) => set("serviceArea", v)} />
              <Field label="Hours" placeholder="Mon–Fri 8am–6pm" value={state.businessHours ?? ""} onChange={(v) => set("businessHours", v)} />
              <Field label="Business phone" type="tel" value={state.phone} onChange={(v) => set("phone", v)} />
              <Field label="Business email" type="email" value={state.email} onChange={(v) => set("email", v)} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">What kinds of calls should the AI handle?</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {CALL_GOALS.map((g) => (
                  <CheckRow
                    key={g}
                    label={g}
                    checked={callGoals.includes(g)}
                    onChange={(c) =>
                      setCallGoals(c
                        ? [...callGoals, g]
                        : callGoals.filter((x) => x !== g))
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Pick what your receptionist should ask every caller.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {COLLECT_OPTIONS.map((q) => (
                  <CheckRow
                    key={q}
                    label={q}
                    checked={state.intakeQuestions.includes(q)}
                    onChange={(c) =>
                      set("intakeQuestions", c
                        ? [...state.intakeQuestions, q]
                        : state.intakeQuestions.filter((x) => x !== q))
                    }
                  />
                ))}
                {DEFAULT_INTAKE_QUESTIONS.filter((q) => !COLLECT_OPTIONS.some((o) => o.toLowerCase() === q.toLowerCase())).map((q) => (
                  <CheckRow
                    key={q}
                    label={q}
                    checked={state.intakeQuestions.includes(q)}
                    onChange={(c) =>
                      set("intakeQuestions", c
                        ? [...state.intakeQuestions, q]
                        : state.intakeQuestions.filter((x) => x !== q))
                    }
                  />
                ))}
              </div>
              <div className="mt-6">
                <Label>Custom questions</Label>
                <div className="flex gap-2 mt-2">
                  <Input value={customQ} onChange={(e) => setCustomQ(e.target.value)} placeholder="e.g. Are you a returning customer?" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const v = customQ.trim();
                      if (!v) return;
                      set("intakeQuestions", [...state.intakeQuestions, v]);
                      setCustomQ("");
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {state.intakeQuestions
                    .filter((q) => ![...COLLECT_OPTIONS, ...DEFAULT_INTAKE_QUESTIONS].some((o) => o.toLowerCase() === q.toLowerCase()))
                    .map((q) => (
                      <span key={q} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
                        {q}
                        <button onClick={() => set("intakeQuestions", state.intakeQuestions.filter((x) => x !== q))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">How should your receptionist sound?</p>
              <div className="grid sm:grid-cols-3 gap-2">
                {TONE_OPTIONS.map((t) => (
                  <label key={t} className={`flex items-center justify-center rounded-lg border p-4 cursor-pointer text-sm font-medium ${state.tone === t ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/50"}`}>
                    <input
                      type="radio"
                      name="tone"
                      className="sr-only"
                      checked={state.tone === t}
                      onChange={() => set("tone", t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <Field label="Receptionist name" value={state.assistantName} onChange={(v) => set("assistantName", v)} />
                <Field label="Greeting" value={state.greeting} onChange={(v) => set("greeting", v)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                When an existing customer calls, we'll forward the call to your line by default.
                If your line doesn't answer, the AI takes a message and sends it to your alert number.
              </p>
              <ToggleRow
                label="Forward existing customer calls to my phone"
                value={existingCustomerForward}
                onChange={setExistingCustomerForward}
              />
              {existingCustomerForward && (
                <Field
                  label="Forward to phone number"
                  type="tel"
                  value={state.transferPhone ?? ""}
                  onChange={(v) => set("transferPhone", v)}
                />
              )}
              <Field label="Owner alert SMS number" type="tel" value={state.ownerSms ?? ""} onChange={(v) => set("ownerSms", v)} />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Your script is ready to generate.</p>
                  <p className="text-muted-foreground">
                    Review and click below — we'll save it and take you to your dashboard.
                  </p>
                </div>
              </div>
              <pre className="max-h-[320px] overflow-auto rounded-xl border border-border bg-secondary/40 p-4 text-xs font-mono whitespace-pre-wrap">
{generated}
              </pre>
              <Button
                onClick={generateAndFinish}
                disabled={submitting}
                size="lg"
                className="w-full bg-cta hover:opacity-90 shadow-glow h-12"
              >
                {submitting ? "Generating…" : "Generate My AI Receptionist"}
              </Button>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={prev} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} className="bg-cta hover:opacity-90 shadow-glow h-11 px-6">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <span />
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <RequestSetupBanner variant="compact" />
          <div className="rounded-xl border border-border bg-card p-5 text-sm">
            <p className="font-semibold">We set this up for you</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>• Live in 24 hours</li>
              <li>• No tech skills required</li>
              <li>• You just answer the leads</li>
            </ul>
          </div>
        </aside>
      </section>
    </Layout>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="" disabled>Pick one…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/50">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`h-6 w-11 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-secondary"}`}
        aria-pressed={value}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/50">
      <input type="checkbox" className="accent-primary h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}