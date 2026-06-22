import Layout from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import {
  loadWizardState,
  saveWizardState,
  clearWizardState,
  defaultWizardState,
  getWizardOwner,
  setWizardOwner,
  type WizardState,
} from "@/lib/wizardSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { INDUSTRIES, DEFAULT_INTAKE_QUESTIONS, TRANSFER_TRIGGERS, FALLBACK_ACTIONS } from "@/lib/constants";
import RequestSetupBanner from "@/components/RequestSetupBanner";
import { generateAssistantPrompt } from "@/lib/generatePrompt";
import { ArrowRight, ArrowLeft, Plus, X, Sparkles, Phone } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import PhoneNumberPicker from "@/components/PhoneNumberPicker";

const STEPS = [
  "Business Info",
  "Phone Setup",
  "Call Handling",
  "AI Receptionist Setup",
  "Voice & Greeting",
  "Review & Launch",
] as const;

const CALL_GOALS = ["Capture leads", "Existing customers", "Info calls"] as const;
const TONE_OPTIONS = ["Friendly", "Direct", "Helpful"] as const;
const COLLECT_OPTIONS = ["Name", "Phone", "Issue", "Address", "Urgency"] as const;
const PRIMARY_TREATMENT_OPTIONS = [
  "Botox", "Filler", "Microneedling", "Laser hair removal", "Laser skin resurfacing",
  "Hydrafacial", "Body contouring", "Chemical peels", "IPL", "PRP", "Threads",
  "IV therapy", "Dermaplaning", "B12 injections",
] as const;
const CLOSED_DAY_OPTIONS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const CALLBACK_TIMELINE_OPTIONS = ["today", "within 24 hours", "by tomorrow", "shortly"] as const;

const STEP_KEY = "callcapture.wizard.step";

export default function Setup() {
  const navigate = useNavigate();
  const [state, setState] = useState<WizardState>(loadWizardState);
  const [step, setStep] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STEP_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n >= 0 && n < STEPS.length ? n : 0;
    } catch {
      return 0;
    }
  });
  const [customQ, setCustomQ] = useState("");
  const [callGoals, setCallGoals] = useState<string[]>(["Capture leads"]);
  const [existingCustomerForward, setExistingCustomerForward] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { saveWizardState(state); }, [state]);
  useEffect(() => {
    try { localStorage.setItem(STEP_KEY, String(step)); } catch { /* ignore */ }
  }, [step]);

  // Reset wizard state whenever the signed-in user differs from the one whose
  // data is currently in localStorage. Prevents any previous account (including
  // the super admin) from leaking into a brand-new subaccount's onboarding.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (cancelled) return;
      const currentUserId = u.user?.id ?? null;
      const storedOwner = getWizardOwner();
      if (storedOwner !== currentUserId) {
        clearWizardState();
        try { localStorage.setItem(STEP_KEY, "0"); } catch { /* ignore */ }
        setState(defaultWizardState);
        setStep(0);
        setWizardOwner(currentUserId);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const generated = useMemo(() => generateAssistantPrompt(state), [state]);

  function next() {
    if (step === 0 && (!state.businessName.trim() || !state.industry)) {
      toast({ title: "Add business name and type", variant: "destructive" });
      return;
    }
    if (step === 1) {
      const mode = state.phoneMode;
      if (mode === "new" && !(state.preferredAreaCode || "").trim()) {
        toast({ title: "Enter a preferred area code", variant: "destructive" });
        return;
      }
      if (mode === "existing" && !(state.businessPhone || "").trim()) {
        toast({ title: "Enter your current business phone number", variant: "destructive" });
        return;
      }
    }
    if (step === 2 && callGoals.length === 0) {
      toast({ title: "Pick at least one call goal", variant: "destructive" });
      return;
    }
    if (step === 4 && !state.assistantName.trim()) {
      toast({ title: "Give your receptionist a name", variant: "destructive" });
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function prev() {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
            primary_treatments: state.primaryTreatments,
            callback_timeline: state.callbackTimeline,
            closed_days: state.closedDays,
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

      try { localStorage.removeItem(STEP_KEY); } catch { /* ignore */ }
      clearWizardState();

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
        <div className="container py-10 md:py-14">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Let's set up your AI receptionist
            </h1>
            <p className="mt-2 text-muted-foreground">
              We set this up for you. Live in 24 hours.
            </p>
            <Progress value={((step + 1) / STEPS.length) * 100} className="mt-6 h-2" />
          </div>
        </div>
      </section>

      <section className="container pb-20 grid lg:grid-cols-[1fr_320px] gap-8 -mt-4">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card-soft">
          <h2 className="text-xl font-semibold mb-6">{STEPS[step]}</h2>

          {/* Step 1: Business Info */}
          {step === 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Business name *" value={state.businessName} onChange={(v) => set("businessName", v)} />
              <SelectField label="Business type *" value={state.industry} onChange={(v) => set("industry", v)} options={INDUSTRIES} />
              <Field label="Service area" placeholder="e.g. Jacksonville + 30 mi" value={state.serviceArea ?? ""} onChange={(v) => set("serviceArea", v)} />
              <Field label="Hours" placeholder="Mon–Fri 8am–6pm" value={state.businessHours ?? ""} onChange={(v) => set("businessHours", v)} />
              <Field label="Business email" type="email" value={state.email} onChange={(v) => set("email", v)} />
              <div className="md:col-span-2 space-y-2">
                <Label>Closed days</Label>
                <div className="grid sm:grid-cols-4 gap-2">
                  {CLOSED_DAY_OPTIONS.map((d) => (
                    <CheckRow
                      key={d}
                      label={d}
                      checked={state.closedDays.includes(d)}
                      onChange={(c) =>
                        set("closedDays", c
                          ? [...state.closedDays, d]
                          : state.closedDays.filter((x) => x !== d))
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Phone Setup */}
          {step === 1 && (
            <PhoneSetupStep state={state} set={set} clientId={clientId} />
          )}

          {/* Step 3: Call Handling */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-3">What kinds of calls should the AI handle?</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {CALL_GOALS.map((g) => (
                    <CheckRow
                      key={g}
                      label={g}
                      checked={callGoals.includes(g)}
                      onChange={(c) =>
                        setCallGoals(c ? [...callGoals, g] : callGoals.filter((x) => x !== g))
                      }
                    />
                  ))}
                </div>
              </div>

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

              <ToggleRow
                label="Answer calls after hours"
                value={state.afterHoursEnabled}
                onChange={(v) => set("afterHoursEnabled", v)}
              />

              <SelectField
                label="If no one picks up the transfer"
                value={state.fallbackAction}
                onChange={(v) => set("fallbackAction", v)}
                options={FALLBACK_ACTIONS as readonly string[]}
              />

              <SelectField
                label="Callback promise"
                value={state.callbackTimeline}
                onChange={(v) => set("callbackTimeline", v as WizardState["callbackTimeline"])}
                options={CALLBACK_TIMELINE_OPTIONS as readonly string[]}
              />
            </div>
          )}

          {/* Step 4: AI Receptionist Setup */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
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

              <div>
                <p className="text-sm text-muted-foreground mb-3">Transfer the call when…</p>
                <div className="grid sm:grid-cols-2 gap-2">
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
                <p className="text-sm text-muted-foreground mb-3">
                  Treatments your spa offers (helps the AI answer service questions naturally)
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {PRIMARY_TREATMENT_OPTIONS.map((t) => (
                    <CheckRow
                      key={t}
                      label={t}
                      checked={state.primaryTreatments.includes(t)}
                      onChange={(c) =>
                        set("primaryTreatments", c
                          ? [...state.primaryTreatments, t]
                          : state.primaryTreatments.filter((x) => x !== t))
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Voice & Greeting */}
          {step === 4 && (
            <div className="space-y-5">
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
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Receptionist name *" value={state.assistantName} onChange={(v) => set("assistantName", v)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Greeting</label>
                <Textarea
                  value={state.greeting}
                  onChange={(e) => set("greeting", e.target.value)}
                  placeholder={`Thanks for calling ${state.businessName || "our business"}, how can I help you today?`}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  After launch, use Place Test Call from Settings to hear the real voice on your phone.
                </p>
              </div>
            </div>
          )}

          {/* Step 6: Review & Launch */}
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
              <Button
                onClick={generateAndFinish}
                disabled={submitting}
                className="bg-cta hover:opacity-90 shadow-glow h-11 px-6"
              >
                {submitting ? "Generating…" : "Generate My AI Receptionist"}
              </Button>
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

function PhoneSetupStep({
  state,
  set,
  clientId,
}: {
  state: WizardState;
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  clientId: string | null;
}) {
  const mode = state.phoneMode ?? "new";

  function setMode(m: "new" | "existing" | "test") {
    set("phoneMode", m);
    if (m === "new") {
      set("phone", state.assignedCallcaptureNumber ?? "");
    } else if (m === "existing") {
      set("phone", state.businessPhone ?? "");
    } else {
      set("phone", "");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">Set Up Your Business Phone</h3>
        <p className="text-sm text-muted-foreground mt-1">
          This is the number your customers will call.
        </p>
      </div>

      {/* Section 1: Choose phone type */}
      <div className="space-y-3">
        <Label>Phone type</Label>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as "new" | "existing" | "test")}
          className="grid gap-2"
        >
          <PhoneOption value="new" title="Get a new Vektuor number" hint="Recommended" current={mode} />
          <PhoneOption value="existing" title="Use my existing business number" hint="Forward missed calls to your AI receptionist" current={mode} />
          <PhoneOption value="test" title="Test mode for now" hint="Use the demo number while setup is being finalized" current={mode} />
        </RadioGroup>
      </div>

      {/* Section 2: Dynamic inputs */}
      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        {mode === "new" && (
          <PhoneNumberPicker
            clientId={clientId}
            preferredAreaCode={state.preferredAreaCode ?? ""}
            onAreaCodeChange={(v) => set("preferredAreaCode", v)}
            assignedNumber={state.assignedCallcaptureNumber || null}
            numberStatus={(state as unknown as { numberStatus?: string }).numberStatus ?? null}
            onProvisioned={(phone, _sid, _status) => {
              set("assignedCallcaptureNumber", phone);
              set("phone", phone);
              set("phoneMode", "new");
            }}
          />
        )}

        {mode === "existing" && (
          <div className="space-y-2">
            <Label>Current business phone number</Label>
            <Input
              type="tel"
              placeholder="(555) 555-1234"
              value={state.businessPhone ?? ""}
              onChange={(e) => {
                set("businessPhone", e.target.value);
                set("phone", e.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              You'll forward missed calls to your AI receptionist.
            </p>
          </div>
        )}

        {mode === "test" && (
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Use the demo number while setup is being finalized. You can switch to a real number anytime from Settings.
            </p>
          </div>
        )}
      </div>

      {/* Owner alert SMS */}
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Owner alert SMS number"
          type="tel"
          placeholder="Where new lead texts go"
          value={state.ownerSms ?? ""}
          onChange={(v) => set("ownerSms", v)}
        />
      </div>

      {/* Section 3: How it works */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold mb-2">When someone calls your number:</p>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Your AI receptionist answers instantly</li>
          <li>• Captures customer details</li>
          <li>• Sends the lead to you</li>
          <li>• Optionally forwards the call</li>
        </ul>
      </div>
    </div>
  );
}

function PhoneOption({
  value,
  title,
  hint,
  current,
}: {
  value: string;
  title: string;
  hint: string;
  current: string;
}) {
  const active = current === value;
  return (
    <label
      htmlFor={`phone-mode-${value}`}
      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
      }`}
    >
      <RadioGroupItem id={`phone-mode-${value}`} value={value} />
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </label>
  );
}
