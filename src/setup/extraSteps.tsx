import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, PhoneCall, Rocket, Sparkles, MessageSquare, Calendar, Bell, Database, ClipboardCheck } from "lucide-react";
import { TestCallButton } from "@/components/TestCallButton";
import { supabase } from "@/integrations/supabase/client";
import type { StepProps } from "./steps";
import { STEPS } from "./schema";

// -------------------- Step 0: Welcome --------------------

export function StepWelcome({ data }: StepProps) {
  const bullets = [
    { icon: Sparkles, label: "Find your business & confirm details" },
    { icon: PhoneCall, label: "Get a dedicated Vektuor phone number" },
    { icon: MessageSquare, label: "Pick a voice & write your greeting" },
    { icon: Calendar, label: "Set hours, forwarding & voicemail" },
    { icon: Bell, label: "Choose how you get notified" },
    { icon: Database, label: "Connect your CRM (optional)" },
    { icon: ClipboardCheck, label: "Place a real test call & go live" },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">
          Hi{data.owner_name ? `, ${data.owner_name.split(" ")[0]}` : ""} — let's get your AI receptionist live.
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Takes about 10 minutes. Your progress is saved automatically so you can come back any time.
        </p>
      </div>
      <ul className="space-y-2">
        {bullets.map((b) => (
          <li key={b.label} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
              <b.icon className="h-4 w-4" />
            </span>
            <span>{b.label}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Press <strong>Get started</strong> below when you're ready.
      </p>
    </div>
  );
}

// -------------------- Step 8: CRM --------------------

const CRM_OPTIONS = [
  { id: "servanahq", label: "ServanaHQ", available: true, blurb: "Sync leads, jobs & customers automatically." },
  { id: "housecallpro", label: "Housecall Pro", available: false, blurb: "Coming soon." },
  { id: "jobber", label: "Jobber", available: false, blurb: "Coming soon." },
  { id: "servicetitan", label: "ServiceTitan", available: false, blurb: "Coming soon." },
];

export function StepCrm({ data, save }: StepProps) {
  const [saving, setSaving] = useState(false);

  async function pick(provider: string | null) {
    setSaving(true);
    await save({ crm_provider: provider });
    setSaving(false);
  }

  async function toggleInterest(id: string) {
    const next = data.crm_interest.includes(id)
      ? data.crm_interest.filter((x) => x !== id)
      : [...data.crm_interest, id];
    await save({ crm_interest: next });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect a CRM so captured leads land directly in your existing pipeline. You can also skip and connect later from Settings.
      </p>
      <div className="grid gap-3">
        {CRM_OPTIONS.map((c) => {
          const selected = data.crm_provider === c.id;
          const interested = data.crm_interest.includes(c.id);
          return (
            <div key={c.id} className={`rounded-xl border p-4 ${selected ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.label}</h3>
                    {!c.available && <Badge variant="secondary">Coming soon</Badge>}
                    {selected && <Badge>Selected</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{c.blurb}</p>
                </div>
                {c.available ? (
                  <Button
                    size="sm"
                    variant={selected ? "outline" : "default"}
                    disabled={saving}
                    onClick={() => pick(selected ? null : c.id)}
                  >
                    {selected ? "Disconnect" : "Connect"}
                  </Button>
                ) : (
                  <Button size="sm" variant={interested ? "default" : "outline"} onClick={() => toggleInterest(c.id)}>
                    {interested ? "Notify me ✓" : "Notify me"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="text-sm text-muted-foreground underline"
        onClick={() => pick("none")}
      >
        Skip — I'll connect a CRM later
      </button>
    </div>
  );
}

// -------------------- Step 9: Test call --------------------

export function StepTestCall({ data, save, clientId }: StepProps) {
  const [enteredAt] = useState<string>(() => new Date().toISOString());
  const [latestCall, setLatestCall] = useState<any | null>(null);
  const [turns, setTurns] = useState<any[]>([]);
  const [lead, setLead] = useState<any | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const poll = async () => {
      const { data: calls } = await supabase
        .from("callcapture_calls")
        .select("*")
        .eq("client_id", clientId)
        .gte("created_at", enteredAt)
        .order("created_at", { ascending: false })
        .limit(1);
      const call = calls?.[0] ?? null;
      if (cancelled) return;
      setLatestCall(call);
      if (call) {
        if (!data.first_test_call_id) {
          save({ first_test_call_id: call.id });
        }
        const [{ data: t }, { data: leads }] = await Promise.all([
          supabase.from("callcapture_transcript_turns").select("*").eq("call_id", call.id).order("created_at", { ascending: true }),
          supabase.from("callcapture_leads").select("*").eq("client_id", clientId).gte("created_at", enteredAt).order("created_at", { ascending: false }).limit(1),
        ]);
        if (!cancelled) {
          setTurns(t ?? []);
          setLead(leads?.[0] ?? null);
        }
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [clientId, enteredAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Place a real call so you can hear your receptionist and see how leads are captured. Enter your own number — your phone will ring within a few seconds.
      </p>
      <div>
        <TestCallButton clientId={clientId ?? undefined} />
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="font-semibold text-sm mb-2">Live transcript</h3>
        {!latestCall ? (
          <p className="text-xs text-muted-foreground">Waiting for a test call…</p>
        ) : turns.length === 0 ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Call in progress — transcript will appear here.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-auto">
            {turns.map((t: any) => (
              <div key={t.id} className={`text-xs rounded-md px-3 py-2 ${t.speaker === "assistant" ? "bg-primary/10 text-foreground" : "bg-secondary/40"}`}>
                <span className="font-medium opacity-70 mr-1">{t.speaker}:</span>
                {t.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="font-semibold text-sm mb-2">Captured lead</h3>
        {!lead ? (
          <p className="text-xs text-muted-foreground">No lead captured yet.</p>
        ) : (
          <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">Name</dt><dd>{lead.caller_name || "—"}</dd>
            <dt className="text-muted-foreground">Phone</dt><dd>{lead.phone || "—"}</dd>
            <dt className="text-muted-foreground">Service</dt><dd>{lead.service_type || "—"}</dd>
            <dt className="text-muted-foreground">Address</dt><dd>{lead.address || "—"}</dd>
          </dl>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Happy with the result? Continue to <strong>Go Live</strong>. You can run more test calls anytime from the dashboard.
      </p>
    </div>
  );
}

// -------------------- Step 10: Go Live --------------------

type Check = { label: string; ok: boolean; required: boolean; step: number };

export function StepGoLive({ data, onEdit }: StepProps) {
  const checks: Check[] = useMemo(() => [
    { label: "Business details saved", ok: !!(data.business_name && data.business_phone), required: true, step: 3 },
    { label: "Vektuor number provisioned", ok: !!data.assigned_callcapture_number, required: true, step: 4 },
    { label: "AI voice selected", ok: !!data.voice_id, required: true, step: 5 },
    { label: "Greeting written", ok: !!data.greeting.trim(), required: true, step: 6 },
    { label: "Call handling configured", ok: true, required: false, step: 7 },
    { label: "Notifications turned on", ok: data.notification_settings.sms_enabled || data.notification_settings.email_enabled, required: true, step: 8 },
    { label: "CRM connected or skipped", ok: !!data.crm_provider, required: false, step: 9 },
    { label: "Test call placed", ok: !!data.first_test_call_id, required: false, step: 10 },
  ], [data]);

  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Final checklist. Fix any required items, then press <strong>Go Live</strong> to publish your AI receptionist.
      </p>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center gap-3">
              {c.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
              <span>
                {c.label}
                {c.required && !c.ok && <Badge variant="destructive" className="ml-2">Required</Badge>}
                {!c.required && !c.ok && <Badge variant="secondary" className="ml-2">Recommended</Badge>}
              </span>
            </div>
            {!c.ok && onEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(c.step)}>Fix</Button>
            )}
          </li>
        ))}
      </ul>
      {!requiredOk && (
        <p className="text-xs text-destructive">Complete the required items above before going live.</p>
      )}
    </div>
  );
}

export { STEPS };