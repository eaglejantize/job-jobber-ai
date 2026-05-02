import Layout from "@/components/Layout";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INDUSTRIES, DEFAULT_INTAKE_QUESTIONS, TRANSFER_TRIGGERS, FALLBACK_ACTIONS } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import { Plus, X, Loader2 } from "lucide-react";
import { generateAssistantPrompt } from "@/lib/generatePrompt";
import { Link } from "react-router-dom";
import VoicePicker from "@/components/VoicePicker";
import { DEFAULT_VOICE_ID, VOICES, getVoiceById, type VoicePersona } from "@/lib/voices";

const TONE_OPTIONS = ["Friendly", "Direct", "Helpful", "Professional", "Warm"] as const;
const COLLECT_OPTIONS = ["Name", "Phone", "Issue", "Address", "Urgency"] as const;

type BusinessRow = {
  id: string;
  business_name: string;
  industry: string | null;
  phone: string | null;
  email: string | null;
  service_area: string | null;
  business_hours: string | null;
};

type ConfigRow = {
  id: string;
  business_id: string;
  assistant_name: string | null;
  greeting: string | null;
  tone: string | null;
  after_hours_enabled: boolean | null;
  transfer_enabled: boolean | null;
  transfer_phone: string | null;
  intake_questions: string[] | null;
  call_rules: Record<string, unknown> | null;
  notification_settings: Record<string, unknown> | null;
};

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [biz, setBiz] = useState<BusinessRow | null>(null);
  const [cfg, setCfg] = useState<ConfigRow | null>(null);
  const [alertPhone, setAlertPhone] = useState("");
  const [customQ, setCustomQ] = useState("");
  const nameManuallyEditedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: bRows }, { data: cRows }, { data: client }] = await Promise.all([
        supabase.from("callcapture_businesses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("callcapture_assistant_configs").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1),
        supabase.from("callcapture_clients").select("alert_phone").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setBiz((bRows?.[0] as BusinessRow) ?? null);
      setCfg((cRows?.[0] as ConfigRow) ?? null);
      setAlertPhone(client?.alert_phone ?? "");
      // If the saved name doesn't match any known voice and isn't empty, treat it as user-edited.
      const savedName = (cRows?.[0] as ConfigRow | undefined)?.assistant_name?.trim() ?? "";
      const matchesVoice = !!savedName && VOICES.some((v) => v.label.toLowerCase() === savedName.toLowerCase());
      nameManuallyEditedRef.current = !!savedName && !matchesVoice;
      setLoading(false);
    })();
  }, [user]);

  if (authLoading || loading) {
    return <Layout><div className="container py-20 text-muted-foreground">Loading…</div></Layout>;
  }

  if (!biz || !cfg) {
    return (
      <Layout>
        <section className="container py-12 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">Finish setup first to manage your assistant settings.</p>
          <Button asChild className="mt-6 bg-cta hover:opacity-90 shadow-glow">
            <Link to="/setup">Run setup wizard</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  const setBizField = <K extends keyof BusinessRow>(k: K, v: BusinessRow[K]) =>
    setBiz((b) => (b ? { ...b, [k]: v } : b));
  const setCfgField = <K extends keyof ConfigRow>(k: K, v: ConfigRow[K]) =>
    setCfg((c) => (c ? { ...c, [k]: v } : c));

  async function saveBusiness() {
    if (!biz) return;
    setSaving(true);
    const { error } = await supabase.from("callcapture_businesses").update({
      business_name: biz.business_name,
      industry: biz.industry,
      phone: biz.phone,
      email: biz.email,
      service_area: biz.service_area,
      business_hours: biz.business_hours,
    }).eq("id", biz.id);
    setSaving(false);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    else toast({ title: "Business info saved" });
  }

  async function savePhone() {
    if (!biz || !user) return;
    setSaving(true);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("callcapture_businesses").update({ phone: biz.phone }).eq("id", biz.id),
      supabase.from("callcapture_clients").update({ alert_phone: alertPhone }).eq("user_id", user.id),
    ]);
    setSaving(false);
    if (e1 || e2) toast({ title: "Couldn't save", description: (e1 ?? e2)!.message, variant: "destructive" });
    else toast({ title: "Phone settings saved" });
  }

  async function regeneratePrompt(updated: ConfigRow, updatedBiz: BusinessRow) {
    const intake = (updated.intake_questions ?? []) as string[];
    return generateAssistantPrompt({
      businessName: updatedBiz.business_name,
      industry: updatedBiz.industry ?? "",
      phone: updatedBiz.phone ?? "",
      email: updatedBiz.email ?? "",
      serviceArea: updatedBiz.service_area ?? "",
      businessHours: updatedBiz.business_hours ?? "",
      assistantName: updated.assistant_name ?? "Riley",
      greeting: updated.greeting ?? "",
      tone: (updated.tone ?? "Friendly") as never,
      afterHoursEnabled: !!updated.after_hours_enabled,
      transferEnabled: !!updated.transfer_enabled,
      transferPhone: updated.transfer_phone ?? "",
      intakeQuestions: intake,
      transferTriggers: ((updated.call_rules?.transferTriggers as string[]) ?? []),
      fallbackAction: ((updated.call_rules?.fallbackAction as string) ?? "Take a message"),
      ownerName: ((updated.notification_settings?.ownerName as string) ?? ""),
      ownerSms: ((updated.notification_settings?.ownerSms as string) ?? ""),
      ownerEmail: ((updated.notification_settings?.ownerEmail as string) ?? ""),
      sendSms: ((updated.notification_settings?.sendSms as boolean) ?? true),
      sendEmail: ((updated.notification_settings?.sendEmail as boolean) ?? true),
    });
  }

  async function saveCallHandling() {
    if (!cfg || !biz) return;
    setSaving(true);
    const generated_prompt = await regeneratePrompt(cfg, biz);
    const { error } = await supabase.from("callcapture_assistant_configs").update({
      after_hours_enabled: cfg.after_hours_enabled,
      transfer_enabled: cfg.transfer_enabled,
      transfer_phone: cfg.transfer_phone,
      call_rules: (cfg.call_rules ?? {}) as never,
      generated_prompt,
    }).eq("id", cfg.id);
    setSaving(false);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    else toast({ title: "Call handling saved" });
  }

  async function saveAi() {
    if (!cfg || !biz) return;
    setSaving(true);
    const generated_prompt = await regeneratePrompt(cfg, biz);
    const notification_settings = (cfg.notification_settings ?? {}) as Record<string, unknown>;
    const { error } = await supabase.from("callcapture_assistant_configs").update({
      assistant_name: cfg.assistant_name,
      greeting: cfg.greeting,
      tone: cfg.tone,
      intake_questions: cfg.intake_questions ?? [],
      notification_settings: notification_settings as never,
      generated_prompt,
    }).eq("id", cfg.id);
    setSaving(false);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    else toast({ title: "AI settings saved" });
  }

  const intake = (cfg.intake_questions ?? []) as string[];
  const callRules = (cfg.call_rules ?? {}) as { transferTriggers?: string[]; fallbackAction?: string };
  const transferTriggers = callRules.transferTriggers ?? [];
  const fallbackAction = callRules.fallbackAction ?? "Take a message";

  const notif = (cfg.notification_settings ?? {}) as Record<string, unknown>;
  const savedVoice = (notif.voice ?? null) as { voice_label?: string; voice_id?: string } | null;
  const selectedVoiceId = (() => {
    if (!savedVoice) return DEFAULT_VOICE_ID;
    const byLabel = savedVoice.voice_label?.toLowerCase();
    const match = byLabel ? getVoiceById(byLabel) : getVoiceById(DEFAULT_VOICE_ID);
    return match.id;
  })();

  function selectVoice(v: VoicePersona) {
    const next = {
      ...notif,
      voice: {
        voice_label: v.label,
        voice_persona: v.persona,
        voice_preview_url: v.previewUrl,
        voice_id: v.voiceId,
      },
    };
    setCfgField("notification_settings", next as ConfigRow["notification_settings"]);
    // Auto-sync receptionist name if user hasn't manually customized it.
    const currentName = (cfg?.assistant_name ?? "").trim();
    const matchesVoice = !!currentName && VOICES.some((vp) => vp.label.toLowerCase() === currentName.toLowerCase());
    if (!nameManuallyEditedRef.current && (currentName === "" || matchesVoice)) {
      setCfgField("assistant_name", v.label);
    }
  }

  function resetVoiceToRecommended() {
    selectVoice(getVoiceById(DEFAULT_VOICE_ID));
  }

  function useSelectedVoiceName() {
    const v = getVoiceById(selectedVoiceId);
    setCfgField("assistant_name", v.label);
    nameManuallyEditedRef.current = false;
  }

  function setCallRule<K extends "transferTriggers" | "fallbackAction">(k: K, v: K extends "transferTriggers" ? string[] : string) {
    setCfgField("call_rules", { ...callRules, [k]: v } as ConfigRow["call_rules"]);
  }

  return (
    <Layout>
      <section className="container py-10 md:py-14 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Update your business, phone, call handling, and AI receptionist.</p>
        </div>

        <Tabs defaultValue="business">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="business">Business Info</TabsTrigger>
            <TabsTrigger value="phone">Phone Setup</TabsTrigger>
            <TabsTrigger value="calls">Call Handling</TabsTrigger>
            <TabsTrigger value="ai">AI Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="business" className="rounded-2xl border border-border bg-card p-6 mt-4 shadow-card-soft">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Business name" value={biz.business_name ?? ""} onChange={(v) => setBizField("business_name", v)} />
              <SelectField label="Business type" value={biz.industry ?? ""} onChange={(v) => setBizField("industry", v)} options={INDUSTRIES} />
              <Field label="Service area" value={biz.service_area ?? ""} onChange={(v) => setBizField("service_area", v)} />
              <Field label="Hours" value={biz.business_hours ?? ""} onChange={(v) => setBizField("business_hours", v)} />
              <Field label="Business email" type="email" value={biz.email ?? ""} onChange={(v) => setBizField("email", v)} />
            </div>
            <SaveButton onClick={saveBusiness} saving={saving} />
          </TabsContent>

          <TabsContent value="phone" className="rounded-2xl border border-border bg-card p-6 mt-4 shadow-card-soft">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Business phone" type="tel" value={biz.phone ?? ""} onChange={(v) => setBizField("phone", v)} />
              <Field label="Owner alert SMS number" type="tel" value={alertPhone} onChange={setAlertPhone} />
            </div>
            <SaveButton onClick={savePhone} saving={saving} />
          </TabsContent>

          <TabsContent value="calls" className="rounded-2xl border border-border bg-card p-6 mt-4 shadow-card-soft space-y-6">
            <ToggleRow label="Forward calls to my phone" value={!!cfg.transfer_enabled} onChange={(v) => setCfgField("transfer_enabled", v)} />
            {cfg.transfer_enabled && (
              <Field label="Forward to phone number" type="tel" value={cfg.transfer_phone ?? ""} onChange={(v) => setCfgField("transfer_phone", v)} />
            )}
            <ToggleRow label="Answer calls after hours" value={!!cfg.after_hours_enabled} onChange={(v) => setCfgField("after_hours_enabled", v)} />
            <SelectField label="If no one picks up the transfer" value={fallbackAction} onChange={(v) => setCallRule("fallbackAction", v)} options={FALLBACK_ACTIONS as readonly string[]} />
            <div>
              <p className="text-sm text-muted-foreground mb-3">Transfer the call when…</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {TRANSFER_TRIGGERS.map((t) => (
                  <CheckRow key={t} label={t} checked={transferTriggers.includes(t)} onChange={(c) =>
                    setCallRule("transferTriggers", c ? [...transferTriggers, t] : transferTriggers.filter((x) => x !== t))
                  } />
                ))}
              </div>
            </div>
            <SaveButton onClick={saveCallHandling} saving={saving} />
          </TabsContent>

          <TabsContent value="ai" className="rounded-2xl border border-border bg-card p-6 mt-4 shadow-card-soft space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>What should your receptionist say their name is?</Label>
                <p className="text-xs text-muted-foreground">
                  Customers may hear this name during calls. You can use the selected voice name or choose your own.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={cfg.assistant_name ?? ""}
                    onChange={(e) => {
                      nameManuallyEditedRef.current = true;
                      setCfgField("assistant_name", e.target.value);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={useSelectedVoiceName} className="shrink-0">
                    Use selected voice name
                  </Button>
                </div>
              </div>
              <Field label="Greeting" value={cfg.greeting ?? ""} onChange={(v) => setCfgField("greeting", v)} />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label>Voice</Label>
                <Button type="button" variant="ghost" size="sm" onClick={resetVoiceToRecommended}>
                  Reset to Recommended
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Pick the voice your AI receptionist uses on calls.
              </p>
              <VoicePicker value={selectedVoiceId} onChange={selectVoice} />
            </div>
            <div>
              <Label>Tone</Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">Secondary style for how the voice speaks.</p>
              <div className="grid sm:grid-cols-3 gap-2 mt-2">
                {TONE_OPTIONS.map((t) => (
                  <label key={t} className={`flex items-center justify-center rounded-lg border p-3 cursor-pointer text-sm font-medium ${cfg.tone === t ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/50"}`}>
                    <input type="radio" name="tone" className="sr-only" checked={cfg.tone === t} onChange={() => setCfgField("tone", t)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">What should your receptionist ask every caller?</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {[...COLLECT_OPTIONS, ...DEFAULT_INTAKE_QUESTIONS.filter((q) => !COLLECT_OPTIONS.some((o) => o.toLowerCase() === q.toLowerCase()))].map((q) => (
                  <CheckRow key={q} label={q} checked={intake.includes(q)} onChange={(c) =>
                    setCfgField("intake_questions", c ? [...intake, q] : intake.filter((x) => x !== q))
                  } />
                ))}
              </div>
              <div className="mt-4">
                <Label>Add custom question</Label>
                <div className="flex gap-2 mt-2">
                  <Input value={customQ} onChange={(e) => setCustomQ(e.target.value)} placeholder="e.g. Are you a returning customer?" />
                  <Button type="button" variant="outline" onClick={() => {
                    const v = customQ.trim();
                    if (!v) return;
                    setCfgField("intake_questions", [...intake, v]);
                    setCustomQ("");
                  }}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {intake.filter((q) => ![...COLLECT_OPTIONS, ...DEFAULT_INTAKE_QUESTIONS].some((o) => o.toLowerCase() === q.toLowerCase())).map((q) => (
                    <span key={q} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
                      {q}
                      <button onClick={() => setCfgField("intake_questions", intake.filter((x) => x !== q))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <SaveButton onClick={saveAi} saving={saving} />
          </TabsContent>
        </Tabs>
      </section>
    </Layout>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
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
      <button type="button" onClick={() => onChange(!value)} className={`h-6 w-11 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-secondary"}`} aria-pressed={value}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <div className="mt-6 flex justify-end">
      <Button onClick={onClick} disabled={saving} className="bg-cta hover:opacity-90 shadow-glow">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
      </Button>
    </div>
  );
}