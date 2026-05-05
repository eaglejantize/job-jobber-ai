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
import { Plus, X, Loader2, Phone, PhoneIncoming, Bot, ClipboardList, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import { generateAssistantPrompt } from "@/lib/generatePrompt";
import { Link } from "react-router-dom";
import VoicePicker from "@/components/VoicePicker";
import { DEFAULT_VOICE_ID, VOICES, getVoiceById, type VoicePersona } from "@/lib/voices";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const TONE_OPTIONS = ["Friendly", "Direct", "Helpful", "Professional", "Warm"] as const;
const COLLECT_OPTIONS = ["Name", "Phone", "Issue", "Address", "Urgency"] as const;

type GreetingStyle = "friendly" | "professional" | "direct";

const GREETING_STYLE_OPTIONS: { value: GreetingStyle; label: string; hint: string }[] = [
  { value: "friendly", label: "Friendly (Recommended)", hint: "Warm and welcoming" },
  { value: "professional", label: "Professional", hint: "Formal and polished" },
  { value: "direct", label: "Direct", hint: "Short and to the point" },
];

function buildGreeting(
  style: GreetingStyle,
  includeName: boolean,
  disclosure: boolean,
  business: string,
  name: string,
): string {
  const biz = business.trim() || "your business";
  const nm = name.trim() || "your receptionist";
  const identity = disclosure
    ? ", this is the automated assistant"
    : includeName
      ? `, this is ${nm}`
      : "";
  switch (style) {
    case "professional":
      return `You've reached ${biz}${identity}. How may I assist you?`;
    case "direct":
      return `${biz}${identity}, how can I help you?`;
    case "friendly":
    default:
      return `Thanks for calling ${biz}${identity}. How can I help you today?`;
  }
}

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
  const [clientRow, setClientRow] = useState<{
    id: string;
    alert_phone?: string | null;
    assigned_callcapture_number?: string | null;
    number_status?: string | null;
    preferred_area_code?: string | null;
    business_phone?: string | null;
    phone_mode?: string | null;
  } | null>(null);
  const [customQ, setCustomQ] = useState("");
  const nameManuallyEditedRef = useRef(false);
  const greetingManuallyEditedRef = useRef(false);
  const [greetingStyle, setGreetingStyle] = useState<GreetingStyle>("friendly");
  const [includeName, setIncludeName] = useState<boolean>(true);
  const [disclosureMode, setDisclosureMode] = useState<boolean>(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: bRows }, { data: cRows }, { data: client }] = await Promise.all([
        supabase.from("callcapture_businesses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("callcapture_assistant_configs").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1),
        supabase.from("callcapture_clients").select("id, alert_phone, assigned_callcapture_number, number_status, preferred_area_code, business_phone, phone_mode").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setBiz((bRows?.[0] as BusinessRow) ?? null);
      setCfg((cRows?.[0] as ConfigRow) ?? null);
      setAlertPhone(client?.alert_phone ?? "");
      setClientRow(client ?? null);
      // If the saved name doesn't match any known voice and isn't empty, treat it as user-edited.
      const savedName = (cRows?.[0] as ConfigRow | undefined)?.assistant_name?.trim() ?? "";
      const matchesVoice = !!savedName && VOICES.some((v) => v.label.toLowerCase() === savedName.toLowerCase());
      nameManuallyEditedRef.current = !!savedName && !matchesVoice;
      // Hydrate greeting controls from notification_settings.greeting (if any)
      const notif = ((cRows?.[0] as ConfigRow | undefined)?.notification_settings ?? {}) as Record<string, unknown>;
      const g = (notif.greeting ?? {}) as {
        greeting_style?: GreetingStyle;
        include_name?: boolean;
        disclosure_mode?: boolean;
        final_greeting_text?: string;
      };
      if (g.greeting_style) setGreetingStyle(g.greeting_style);
      if (typeof g.include_name === "boolean") setIncludeName(g.include_name);
      if (typeof g.disclosure_mode === "boolean") setDisclosureMode(g.disclosure_mode);
      const savedGreeting = (cRows?.[0] as ConfigRow | undefined)?.greeting?.trim() ?? "";
      // If saved greeting differs from any composed variant, treat as manually edited.
      if (savedGreeting) {
        const bizName = (bRows?.[0] as BusinessRow | undefined)?.business_name ?? "";
        const composed = buildGreeting(
          g.greeting_style ?? "friendly",
          g.include_name ?? true,
          g.disclosure_mode ?? false,
          bizName,
          savedName,
        );
        greetingManuallyEditedRef.current = savedGreeting !== composed;
      }
      setLoading(false);
    })();
  }, [user]);

  // Auto-sync composed greeting → cfg.greeting unless user manually edited it.
  useEffect(() => {
    if (!cfg || !biz) return;
    if (greetingManuallyEditedRef.current) return;
    const composed = buildGreeting(
      greetingStyle,
      includeName,
      disclosureMode,
      biz.business_name ?? "",
      cfg.assistant_name ?? "",
    );
    if ((cfg.greeting ?? "") !== composed) {
      setCfg((c) => (c ? { ...c, greeting: composed } : c));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetingStyle, includeName, disclosureMode, biz?.business_name, cfg?.assistant_name]);

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
    const nextRules = {
      ...(callRules as Record<string, unknown>),
      ringsBeforeAi: Number((callRules as { ringsBeforeAi?: number }).ringsBeforeAi ?? 3),
      aiAnswerMissed: (callRules as { aiAnswerMissed?: boolean }).aiAnswerMissed !== false,
    };
    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      supabase.from("callcapture_businesses").update({ phone: biz.phone }).eq("id", biz.id),
      supabase.from("callcapture_clients").update({ alert_phone: alertPhone }).eq("user_id", user.id),
      supabase.from("callcapture_assistant_configs").update({
        transfer_enabled: cfg!.transfer_enabled,
        transfer_phone: biz.phone,
        call_rules: nextRules as never,
      }).eq("id", cfg!.id),
    ]);
    setSaving(false);
    if (e1 || e2 || e3) toast({ title: "Couldn't save", description: (e1 ?? e2 ?? e3)!.message, variant: "destructive" });
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
    const notification_settings = {
      ...((cfg.notification_settings ?? {}) as Record<string, unknown>),
      greeting: {
        greeting_style: greetingStyle,
        include_name: includeName,
        disclosure_mode: disclosureMode,
        final_greeting_text: cfg.greeting ?? "",
      },
    };
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
  const callRules = (cfg.call_rules ?? {}) as {
    transferTriggers?: string[];
    fallbackAction?: string;
    ringsBeforeAi?: number;
    aiAnswerMissed?: boolean;
    phone_mode?: "new" | "existing" | "test";
    preferred_area_code?: string;
    business_phone?: string;
    assigned_callcapture_number?: string;
  };
  const transferTriggers = callRules.transferTriggers ?? [];
  const fallbackAction = callRules.fallbackAction ?? "Take a message";
  const ringsBeforeAi = callRules.ringsBeforeAi ?? 3;
  const aiAnswerMissed = callRules.aiAnswerMissed !== false;
  const phoneMode = callRules.phone_mode ?? "existing";
  const preferredAreaCode = callRules.preferred_area_code ?? "";
  const businessPhone = callRules.business_phone ?? biz.phone ?? "";
  const assignedCallcaptureNumber = callRules.assigned_callcapture_number ?? "";

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

  const previewGreeting = buildGreeting(
    greetingStyle,
    includeName,
    disclosureMode,
    biz.business_name ?? "",
    cfg.assistant_name ?? "",
  );

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

          <TabsContent value="phone" className="rounded-2xl border border-border bg-card p-6 mt-4 shadow-card-soft space-y-8">
            {/* Phone setup choice */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Phone Setup</h2>
                <p className="text-sm text-muted-foreground mt-1">Choose how customers reach your AI receptionist.</p>
              </div>
              <div className="grid gap-2">
                {[
                  { v: "new", title: "Get a new CallCapture number", hint: "Recommended" },
                  { v: "existing", title: "Use my existing business number", hint: "Forward missed calls to your AI receptionist" },
                  { v: "test", title: "Test mode for now", hint: "Use the demo number while setup is being finalized" },
                ].map((o) => {
                  const active = phoneMode === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setCfgField("call_rules", { ...callRules, phone_mode: o.v as "new" | "existing" | "test" } as ConfigRow["call_rules"])}
                      className={`text-left flex items-start gap-3 rounded-lg border p-3 transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"}`}
                    >
                      <span className={`mt-1 h-3 w-3 rounded-full border ${active ? "bg-primary border-primary" : "border-muted-foreground"}`} />
                      <span>
                        <span className="block text-sm font-medium">{o.title}</span>
                        <span className="block text-xs text-muted-foreground">{o.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {phoneMode === "new" && (
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <PhoneNumberPicker
                    clientId={clientRow?.id ?? null}
                    preferredAreaCode={clientRow?.preferred_area_code ?? preferredAreaCode}
                    onAreaCodeChange={(v) => {
                      setCfgField("call_rules", { ...callRules, preferred_area_code: v } as ConfigRow["call_rules"]);
                      setClientRow((c) => c ? { ...c, preferred_area_code: v } : c);
                    }}
                    assignedNumber={clientRow?.assigned_callcapture_number ?? null}
                    numberStatus={clientRow?.number_status ?? null}
                    onProvisioned={(phone, _sid, status) => {
                      setClientRow((c) => c ? { ...c, assigned_callcapture_number: phone, number_status: status } : c);
                    }}
                  />
                </div>
              )}

              {phoneMode === "existing" && (
                <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
                  <Label>Current business phone number</Label>
                  <Input
                    type="tel"
                    placeholder="(555) 555-1234"
                    value={businessPhone}
                    onChange={(e) => {
                      setCfgField("call_rules", { ...callRules, business_phone: e.target.value } as ConfigRow["call_rules"]);
                      setBizField("phone", e.target.value);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">You'll forward missed calls to your AI receptionist.</p>
                </div>
              )}

              {phoneMode === "test" && (
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    Use the demo number while setup is being finalized.
                  </p>
                </div>
              )}
            </div>

            {/* How calls are handled */}
            <div>
              <h2 className="text-xl font-semibold tracking-tight">How Your Calls Are Handled</h2>
              <p className="text-sm text-muted-foreground mt-1">When someone calls your number:</p>
              <ol className="mt-4 space-y-2 text-sm">
                {[
                  "Your phone rings first",
                  "If you don't answer after a few rings, your AI receptionist answers",
                  "It collects the caller's information (name, phone, issue)",
                  "You receive the details instantly by text",
                  "You can call them back or follow up",
                ].map((line, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{i + 1}</span>
                    <span className="text-foreground/90">{line}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Call flow visual */}
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-2">
                {[
                  { icon: Phone, label: "Customer calls" },
                  { icon: PhoneIncoming, label: "Your phone rings" },
                  { icon: Bot, label: "AI answers if missed" },
                  { icon: ClipboardList, label: "Info captured" },
                  { icon: MessageSquare, label: "You get notified" },
                ].map((s, i, arr) => (
                  <div key={s.label} className="flex md:flex-col items-center gap-2 md:gap-1.5 md:flex-1">
                    <div className="flex md:flex-col items-center gap-2 md:gap-1.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-primary shrink-0">
                        <s.icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-medium text-center">{s.label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight className="hidden md:block h-4 w-4 text-muted-foreground shrink-0 -mt-5" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ring control */}
            <div className="space-y-2">
              <Label>How many rings before AI answers?</Label>
              <select
                value={String(ringsBeforeAi)}
                onChange={(e) => setCfgField("call_rules", { ...callRules, ringsBeforeAi: Number(e.target.value) } as ConfigRow["call_rules"])}
                className="flex h-10 w-full md:w-72 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="1">1 ring</option>
                <option value="2">2 rings</option>
                <option value="3">3 rings (recommended)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                This gives you a chance to answer first. If you miss the call, your AI takes over so you never lose the lead.
              </p>
            </div>

            {/* Settings */}
            <div className="space-y-3">
              <ToggleRow
                label="Let AI answer missed calls"
                value={aiAnswerMissed}
                onChange={(v) => setCfgField("call_rules", { ...callRules, aiAnswerMissed: v } as ConfigRow["call_rules"])}
              />
              <ToggleRow
                label="Forward calls to my phone"
                value={!!cfg.transfer_enabled}
                onChange={(v) => setCfgField("transfer_enabled", v)}
              />
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Your phone number" type="tel" value={biz.phone ?? ""} onChange={(v) => setBizField("phone", v)} />
                <Field label="Where to text me missed-call alerts" type="tel" value={alertPhone} onChange={setAlertPhone} />
              </div>
            </div>

            {/* Value statement */}
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 flex gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90">
                <span className="font-semibold">You never miss a customer again.</span> If you're busy or can't answer, your AI receptionist steps in and captures everything for you.
              </p>
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
            </div>

            {/* Call Greeting */}
            <div className="rounded-xl border border-border p-5 space-y-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Call Greeting</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  The first thing every caller hears. Keep it short and natural.
                </p>
              </div>

              <div className="rounded-lg bg-muted/40 border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Live preview</p>
                <p className="text-base md:text-lg italic">“{previewGreeting}”</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Greeting style</Label>
                  <Select value={greetingStyle} onValueChange={(v) => setGreetingStyle(v as GreetingStyle)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GREETING_STYLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {GREETING_STYLE_OPTIONS.find((o) => o.value === greetingStyle)?.hint}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Include receptionist name</p>
                      <p className="text-xs text-muted-foreground">Adds “this is {cfg.assistant_name?.trim() || "your receptionist"}”</p>
                    </div>
                    <Switch checked={includeName} onCheckedChange={setIncludeName} disabled={disclosureMode} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Let callers know it's an automated assistant</p>
                      <p className="text-xs text-muted-foreground">Optional — for transparency</p>
                    </div>
                    <Switch checked={disclosureMode} onCheckedChange={setDisclosureMode} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Custom greeting (optional override)</Label>
                <div className="flex gap-2">
                  <Input
                    value={cfg.greeting ?? ""}
                    onChange={(e) => {
                      greetingManuallyEditedRef.current = true;
                      setCfgField("greeting", e.target.value);
                    }}
                    placeholder={previewGreeting}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      greetingManuallyEditedRef.current = false;
                      setCfgField("greeting", previewGreeting);
                    }}
                  >
                    Use preview
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Edit only if you want to override the generated greeting above.
                </p>
              </div>
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