import Layout from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import { defaultWizardState, loadWizardState, saveWizardState, type WizardState, wizardSchema } from "@/lib/wizardSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { INDUSTRIES, TONES, DEFAULT_INTAKE_QUESTIONS, TRANSFER_TRIGGERS, FALLBACK_ACTIONS } from "@/lib/constants";
import RequestSetupBanner from "@/components/RequestSetupBanner";
import { generateAssistantPrompt, VAPI_INSTRUCTIONS } from "@/lib/generatePrompt";
import { Copy, ArrowRight, ArrowLeft, Plus, X, Check, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const STEPS = [
  "Business Info",
  "Receptionist Behavior",
  "Intake Questions",
  "Call Handling",
  "Notifications",
  "Your AI Receptionist Is Ready",
];

export default function Setup() {
  const [state, setState] = useState<WizardState>(loadWizardState);
  const [step, setStep] = useState(0);
  const [customQ, setCustomQ] = useState("");

  useEffect(() => { saveWizardState(state); }, [state]);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const generated = useMemo(() => generateAssistantPrompt(state), [state]);

  function next() {
    // Validate per-step (light)
    if (step === 0) {
      const r = wizardSchema.pick({ businessName: true, industry: true, phone: true, email: true })
        .safeParse(state);
      if (!r.success) { toast({ title: "Fill in the required fields", variant: "destructive" }); return; }
    }
    if (step === 1) {
      const r = wizardSchema.pick({ assistantName: true, greeting: true, tone: true })
        .safeParse(state);
      if (!r.success) { toast({ title: "Fill in the required fields", variant: "destructive" }); return; }
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function prev() { setStep((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function saveToCloud() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast({ title: "Sign in to save", description: "Your work is saved locally for now." });
      return;
    }
    const { data: biz, error: be } = await supabase.from("callcapture_businesses").insert({
      user_id: u.user.id,
      business_name: state.businessName,
      industry: state.industry,
      phone: state.phone,
      email: state.email,
      service_area: state.serviceArea || null,
      business_hours: state.businessHours || null,
    }).select("id").single();
    if (be || !biz) { toast({ title: "Save failed", description: be?.message, variant: "destructive" }); return; }
    const { error: ce } = await supabase.from("callcapture_assistant_configs").insert({
      business_id: biz.id,
      user_id: u.user.id,
      assistant_name: state.assistantName,
      greeting: state.greeting,
      tone: state.tone,
      after_hours_enabled: state.afterHoursEnabled,
      transfer_enabled: state.transferEnabled,
      transfer_phone: state.transferPhone || null,
      intake_questions: state.intakeQuestions,
      call_rules: { transferTriggers: state.transferTriggers, fallbackAction: state.fallbackAction },
      notification_settings: {
        ownerName: state.ownerName, ownerSms: state.ownerSms, ownerEmail: state.ownerEmail,
        sendSms: state.sendSms, sendEmail: state.sendEmail,
      },
      generated_prompt: generated,
    });
    if (ce) { toast({ title: "Save failed", description: ce.message, variant: "destructive" }); return; }
    toast({ title: "Saved to your dashboard." });
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
              {step === STEPS.length - 1 ? "Your AI Receptionist Is Ready" : "Let's set up your AI receptionist"}
            </h1>
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
              <SelectField label="Industry *" value={state.industry} onChange={(v) => set("industry", v)} options={INDUSTRIES} />
              <Field label="Business phone *" type="tel" value={state.phone} onChange={(v) => set("phone", v)} />
              <Field label="Business email *" type="email" value={state.email} onChange={(v) => set("email", v)} />
              <Field label="Service area" placeholder="e.g. Jacksonville + 30 mi" value={state.serviceArea ?? ""} onChange={(v) => set("serviceArea", v)} />
              <Field label="Business hours" placeholder="Mon–Fri 8am–6pm" value={state.businessHours ?? ""} onChange={(v) => set("businessHours", v)} />
            </div>
          )}

          {step === 1 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Assistant name *" value={state.assistantName} onChange={(v) => set("assistantName", v)} />
              <SelectField label="Tone *" value={state.tone} onChange={(v) => set("tone", v as WizardState["tone"])} options={[...TONES]} />
              <div className="md:col-span-2 space-y-2">
                <Label>Greeting *</Label>
                <Textarea rows={2} value={state.greeting} onChange={(e) => set("greeting", e.target.value)} />
              </div>
              <ToggleRow label="Answer calls after hours?" value={state.afterHoursEnabled} onChange={(v) => set("afterHoursEnabled", v)} />
              <ToggleRow label="Transfer urgent calls to a human?" value={state.transferEnabled} onChange={(v) => set("transferEnabled", v)} />
              {state.transferEnabled && (
                <div className="md:col-span-2">
                  <Field label="Transfer phone number" type="tel" value={state.transferPhone ?? ""} onChange={(v) => set("transferPhone", v)} />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Pick what your receptionist should ask every caller.
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {DEFAULT_INTAKE_QUESTIONS.map((q) => (
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
                    .filter((q) => !DEFAULT_INTAKE_QUESTIONS.includes(q))
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
            <div className="space-y-6">
              <div>
                <Label className="text-base">When should the AI transfer to a human?</Label>
                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                  {TRANSFER_TRIGGERS.map((t) => (
                    <CheckRow
                      key={t}
                      label={t}
                      checked={state.transferTriggers.includes(t)}
                      onChange={(c) =>
                        set("transferTriggers", c
                          ? [...state.transferTriggers, t]
                          : state.transferTriggers.filter((x) => x !== t))
                      }
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-base">If no one answers the transfer…</Label>
                <div className="mt-3 space-y-2">
                  {FALLBACK_ACTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/50">
                      <input
                        type="radio"
                        name="fallback"
                        className="accent-primary"
                        checked={state.fallbackAction === a}
                        onChange={() => set("fallbackAction", a)}
                      />
                      <span className="text-sm">{a}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Owner name" value={state.ownerName ?? ""} onChange={(v) => set("ownerName", v)} />
              <Field label="Owner SMS number" type="tel" value={state.ownerSms ?? ""} onChange={(v) => set("ownerSms", v)} />
              <Field label="Owner email" type="email" value={state.ownerEmail ?? ""} onChange={(v) => set("ownerEmail", v)} />
              <div className="md:col-span-2 grid sm:grid-cols-2 gap-3">
                <ToggleRow label="Send leads by SMS" value={state.sendSms} onChange={(v) => set("sendSms", v)} />
                <ToggleRow label="Send leads by email" value={state.sendEmail} onChange={(v) => set("sendEmail", v)} />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Your script is ready.</p>
                  <p className="text-muted-foreground">
                    Copy this into your Vapi assistant — or let us set it up for you.
                  </p>
                </div>
              </div>
              <pre className="max-h-[420px] overflow-auto rounded-xl border border-border bg-secondary/40 p-4 text-xs font-mono whitespace-pre-wrap">
{generated}
              </pre>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="bg-cta hover:opacity-90 shadow-glow flex-1 h-12"
                  onClick={() => {
                    navigator.clipboard.writeText(generated);
                    toast({ title: "Copied to clipboard" });
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy Instructions
                </Button>
                <Button asChild variant="outline" className="flex-1 h-12 border-primary/40">
                  <Link to="/support">Request Setup Help</Link>
                </Button>
              </div>
              <details className="rounded-xl border border-border bg-card p-4">
                <summary className="cursor-pointer text-sm font-semibold">How to connect this to Vapi</summary>
                <pre className="mt-3 text-xs whitespace-pre-wrap text-muted-foreground">{VAPI_INSTRUCTIONS}</pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => { navigator.clipboard.writeText(VAPI_INSTRUCTIONS); toast({ title: "Copied" }); }}
                >
                  <Copy className="h-3 w-3" /> Copy Vapi Setup Instructions
                </Button>
              </details>
              <div className="pt-2">
                <Button onClick={saveToCloud} variant="secondary" className="w-full h-11">
                  <Check className="h-4 w-4" /> Save to my dashboard
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Saves to your CallCapture account so you can access it later.
                </p>
              </div>
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
            <p className="font-semibold">Why people pick "white-glove"</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>• Live in 24 hours, no fiddling</li>
              <li>• We handle Vapi, the script, and the number</li>
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

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
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