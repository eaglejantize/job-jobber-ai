import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Check, ChevronRight, ChevronLeft } from "lucide-react";

type Step = 0 | 1 | 2 | 3;

const STEPS = ["Your Phone Number", "Business Hours", "Call Handling", "Review & Activate"];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
];

const TRIGGERS = ["Emergency", "Angry caller", "Existing customer", "High-value job", "Caller asks for a human"];

const FALLBACKS = ["Take a message", "Send SMS to owner", "Promise a callback"];

type ClientRow = {
  id: string;
  phone_mode: string | null;
  preferred_area_code: string | null;
  business_phone: string | null;
  assigned_callcapture_number: string | null;
  number_status: string | null;
  webhook_status: string | null;
  vapi_phone_number_id: string | null;
  vapi_assistant_id: string | null;
  business_hours_24_7: boolean;
  business_hours_schedule: Record<string, { open: string; close: string } | null> | null;
  timezone: string;
  rings_before_answer: number;
  forward_first: boolean;
  forward_phone: string | null;
  answer_after_hours: boolean;
  transfer_fallback: string;
  transfer_triggers: string[];
  setup_status: string;
  payment_status: string;
};

export default function PhoneSetupWizard({ clientId, onSaved }: { clientId: string; onSaved?: () => void }) {
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [c, setC] = useState<ClientRow | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("callcapture_clients")
        .select("id, phone_mode, preferred_area_code, business_phone, assigned_callcapture_number, number_status, webhook_status, vapi_phone_number_id, vapi_assistant_id, business_hours_24_7, business_hours_schedule, timezone, rings_before_answer, forward_first, forward_phone, answer_after_hours, transfer_fallback, transfer_triggers, setup_status, payment_status")
        .eq("id", clientId).maybeSingle();
      if (data) setC(data as ClientRow);
      setLoading(false);
    })();
  }, [clientId]);

  if (loading || !c) return <div className="py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /> Loading…</div>;

  const update = <K extends keyof ClientRow>(k: K, v: ClientRow[K]) => setC((x) => x ? { ...x, [k]: v } : x);

  async function activate() {
    if (!c) return;
    const phoneReady =
      !!c.assigned_callcapture_number &&
      c.number_status === "active" &&
      c.webhook_status === "configured" &&
      !!c.vapi_phone_number_id &&
      !!c.vapi_assistant_id;
    if (!phoneReady) {
      toast.error("Phone routing must be configured before activation.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("callcapture_clients").update({
      phone_mode: c.phone_mode,
      preferred_area_code: c.preferred_area_code,
      business_phone: c.business_phone,
      business_hours_24_7: c.business_hours_24_7,
      business_hours_schedule: c.business_hours_schedule as never,
      timezone: c.timezone,
      rings_before_answer: c.rings_before_answer,
      forward_first: c.forward_first,
      forward_phone: c.forward_phone,
      answer_after_hours: c.answer_after_hours,
      transfer_fallback: c.transfer_fallback,
      transfer_triggers: c.transfer_triggers,
      setup_status: "Active",
    }).eq("id", c.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Your agent is live!");
    onSaved?.();
    navigate("/home");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs hidden md:block ${i === step ? "font-semibold" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {step === 0 && <StepNumber c={c} update={update} />}
      {step === 1 && <StepHours c={c} update={update} />}
      {step === 2 && <StepHandling c={c} update={update} />}
      {step === 3 && <StepReview c={c} />}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => (s - 1) as Step)}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => (s + 1) as Step)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={activate} disabled={saving} className="bg-cta hover:opacity-90 shadow-glow">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save & Activate
          </Button>
        )}
      </div>
    </div>
  );
}

function StepNumber({ c, update }: { c: ClientRow; update: <K extends keyof ClientRow>(k: K, v: ClientRow[K]) => void }) {
  const mode = c.phone_mode ?? "new";
  return (
    <div className="space-y-4">
      {[
        { v: "new", title: "Get a new Vektuor number", hint: "Recommended" },
        { v: "existing", title: "Use my existing business number", hint: "Forward missed calls to your AI receptionist" },
        { v: "test", title: "Test mode for now", hint: "Use the demo number while you finish setup" },
      ].map((o) => {
        const active = mode === o.v;
        return (
          <button key={o.v} type="button" onClick={() => update("phone_mode", o.v)}
            className={`w-full text-left flex items-start gap-3 rounded-lg border p-4 transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"}`}>
            <span className={`mt-1 h-3 w-3 rounded-full border ${active ? "bg-primary border-primary" : "border-muted-foreground"}`} />
            <span>
              <span className="block text-sm font-medium">{o.title}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </span>
          </button>
        );
      })}
      {mode === "existing" && (
        <div className="space-y-2">
          <Label>Your current business number</Label>
          <Input type="tel" value={c.business_phone ?? ""} onChange={(e) => update("business_phone", e.target.value)} placeholder="(555) 555-1234" />
        </div>
      )}
      {mode === "new" && (
        <div className="space-y-2">
          <Label>Preferred area code (optional)</Label>
          <Input value={c.preferred_area_code ?? ""} onChange={(e) => update("preferred_area_code", e.target.value)} placeholder="904" maxLength={3} />
        </div>
      )}
    </div>
  );
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const TIMES = (() => {
  const out = ["00:00"];
  for (let h = 6; h <= 22; h++) for (const m of ["00", "30"]) out.push(`${String(h).padStart(2, "0")}:${m}`);
  return out;
})();

function StepHours({ c, update }: { c: ClientRow; update: <K extends keyof ClientRow>(k: K, v: ClientRow[K]) => void }) {
  const sched = (c.business_hours_schedule ?? {}) as Record<string, { open: string; close: string } | null>;

  function setDay(day: string, key: "open" | "close" | "closed", v: string | boolean) {
    const next = { ...sched };
    if (key === "closed") {
      next[day] = v ? null : { open: "09:00", close: "17:00" };
    } else {
      next[day] = { open: next[day]?.open ?? "09:00", close: next[day]?.close ?? "17:00", [key]: v as string };
    }
    update("business_hours_schedule", next as never);
  }

  function applyToWeekdays() {
    const src = sched.mon ?? { open: "09:00", close: "17:00" };
    const next = { ...sched, mon: src, tue: src, wed: src, thu: src, fri: src };
    update("business_hours_schedule", next as never);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium">Open 24/7</p>
          <p className="text-xs text-muted-foreground">Your AI is always available.</p>
        </div>
        <Switch checked={c.business_hours_24_7} onCheckedChange={(v) => update("business_hours_24_7", v)} />
      </div>

      {!c.business_hours_24_7 && (
        <>
          <div className="space-y-2">
            {DAYS.map((d) => {
              const closed = sched[d] === null;
              return (
                <div key={d} className="flex items-center gap-3 rounded-md border border-border p-2">
                  <span className="w-24 text-sm font-medium">{DAY_LABEL[d]}</span>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={closed} onChange={(e) => setDay(d, "closed", e.target.checked)} />
                    Closed
                  </label>
                  {!closed && (
                    <>
                      <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={sched[d]?.open ?? "09:00"} onChange={(e) => setDay(d, "open", e.target.value)}>
                        {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="text-xs text-muted-foreground">to</span>
                      <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={sched[d]?.close ?? "17:00"} onChange={(e) => setDay(d, "close", e.target.value)}>
                        {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {d === "mon" && (
                        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={applyToWeekdays}>Apply to weekdays</Button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>Timezone</Label>
        <Select value={c.timezone} onValueChange={(v) => update("timezone", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StepHandling({ c, update }: { c: ClientRow; update: <K extends keyof ClientRow>(k: K, v: ClientRow[K]) => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Rings before AI answers</Label>
        <Select value={String(c.rings_before_answer)} onValueChange={(v) => update("rings_before_answer", Number(v))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n} ring{n>1?"s":""}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium">Ring my phone first</p>
          <p className="text-xs text-muted-foreground">Give yourself a chance to pick up before AI takes over.</p>
        </div>
        <Switch checked={c.forward_first} onCheckedChange={(v) => update("forward_first", v)} />
      </div>
      {c.forward_first && (
        <div className="space-y-2">
          <Label>Forward to</Label>
          <Input type="tel" value={c.forward_phone ?? ""} onChange={(e) => update("forward_phone", e.target.value)} placeholder="(555) 555-1234" />
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium">Answer after-hours calls</p>
          <p className="text-xs text-muted-foreground">AI captures leads even when you're closed.</p>
        </div>
        <Switch checked={c.answer_after_hours} onCheckedChange={(v) => update("answer_after_hours", v)} />
      </div>

      <div className="space-y-2">
        <Label>If no one is available, fall back to</Label>
        <Select value={c.transfer_fallback} onValueChange={(v) => update("transfer_fallback", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{FALLBACKS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Transfer the call when…</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          {TRIGGERS.map((t) => {
            const checked = (c.transfer_triggers ?? []).includes(t);
            return (
              <label key={t} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={checked} onChange={(e) => {
                  const list = c.transfer_triggers ?? [];
                  update("transfer_triggers", e.target.checked ? [...list, t] : list.filter((x) => x !== t));
                }} />
                {t}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepReview({ c }: { c: ClientRow }) {
  const sched = (c.business_hours_schedule ?? {}) as Record<string, { open: string; close: string } | null>;
  const hoursLine = c.business_hours_24_7
    ? "Open 24/7"
    : DAYS.map((d) => `${DAY_LABEL[d].slice(0,3)}: ${sched[d] === null ? "Closed" : `${sched[d]?.open ?? "09:00"}–${sched[d]?.close ?? "17:00"}`}`).join(" · ");
  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-5">
      <Row k="Phone mode" v={c.phone_mode ?? "new"} />
      {c.phone_mode === "existing" && <Row k="Existing number" v={c.business_phone ?? "—"} />}
      {c.phone_mode === "new" && c.preferred_area_code && <Row k="Preferred area code" v={c.preferred_area_code} />}
      <Row k="Hours" v={hoursLine} />
      <Row k="Timezone" v={c.timezone} />
      <Row k="Rings before AI" v={`${c.rings_before_answer}`} />
      <Row k="Ring my phone first" v={c.forward_first ? `Yes (${c.forward_phone ?? "—"})` : "No"} />
      <Row k="Answer after-hours" v={c.answer_after_hours ? "Yes" : "No"} />
      <Row k="Fallback" v={c.transfer_fallback} />
      <Row k="Transfer when" v={(c.transfer_triggers ?? []).join(", ") || "—"} />
      <p className="text-xs text-muted-foreground pt-2">Hit "Save & Activate" to turn your AI receptionist on.</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right truncate">{v}</span>
    </div>
  );
}