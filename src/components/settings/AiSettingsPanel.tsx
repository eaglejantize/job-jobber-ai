import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { questionsForIndustry, UNIVERSAL_QUESTIONS } from "@/lib/intakeQuestions";
import { industryLabel } from "@/lib/industries";
import VoicePicker from "@/components/VoicePicker";
import { TestCallButton } from "@/components/TestCallButton";
import ServanaHqSettings from "@/components/settings/ServanaHqSettings";

const TONES = ["Friendly", "Professional", "Direct", "Cheerful", "Calm"];

type ClientRow = {
  id: string;
  business_name: string;
  industry: string | null;
  greeting: string | null;
  include_business_name: boolean;
  human_pause: boolean;
  voice_id: string | null;
  voice_label: string | null;
  selected_voice_catalog_id: string | null;
  voice_provider: string | null;
  voice_provider_voice_id: string | null;
  voice_sync_status: "synced" | "failed" | "pending" | null;
  voice_last_sync_error: string | null;
  intake_questions: string[] | null;
  tone: string;
};

export default function AiSettingsPanel({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [c, setC] = useState<ClientRow | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [customQ, setCustomQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("callcapture_clients")
        .select("id, business_name, industry, greeting, include_business_name, human_pause, voice_id, voice_label, selected_voice_catalog_id, voice_provider, voice_provider_voice_id, voice_sync_status, voice_last_sync_error, intake_questions, tone")
        .eq("id", clientId).maybeSingle();
      if (data) {
        const row = data as ClientRow;
        if (!row.intake_questions || row.intake_questions.length === 0) {
          row.intake_questions = questionsForIndustry(row.industry);
        }
        if (!row.greeting && row.industry === "med_spa") {
          row.greeting = `Thank you for calling ${row.business_name}, your personal concierge is here. How may I assist you today?`;
        }
        setC(row);
      }
      setLoading(false);
    })();
  }, [clientId]);

  if (loading || !c) return <div className="py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /> Loading…</div>;

  const update = <K extends keyof ClientRow>(k: K, v: ClientRow[K]) => setC((x) => x ? { ...x, [k]: v } : x);

  async function generateGreetings() {
    if (!c) return;
    setGenLoading(true);
    const { data, error } = await supabase.functions.invoke("generate-greeting", {
      body: { business_name: c.business_name, industry: c.industry, tone: c.tone, include_business_name: c.include_business_name },
    });
    setGenLoading(false);
    if (error) { toast.error(error.message); return; }
    setOptions((data as { options?: string[] })?.options ?? []);
  }

  async function save() {
    if (!c) return;
    setSaving(true);
    const { error } = await supabase.from("callcapture_clients").update({
      greeting: c.greeting,
      include_business_name: c.include_business_name,
      human_pause: c.human_pause,
      voice_id: c.voice_id,
      voice_label: c.voice_label,
      selected_voice_catalog_id: c.selected_voice_catalog_id,
      voice_provider: c.voice_provider,
      voice_provider_voice_id: c.voice_provider_voice_id,
      voice_sync_status: "pending",
      voice_last_sync_error: null,
      intake_questions: c.intake_questions as never,
      tone: c.tone,
    }).eq("id", c.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("AI settings saved");
    // Push to Vapi
    const { data: syncData, error: syncErr } = await supabase.functions.invoke("update-vapi-agent", { body: { client_id: c.id } });
    if (syncErr || !(syncData as { ok?: boolean })?.ok) {
      const msg = syncErr?.message || (syncData as { error?: string })?.error || "Unknown error";
      toast.error(`Failed to update agent: ${msg}`);
    } else {
      toast.success("Agent updated");
    }
  }

  const allQs = questionsForIndustry(c.industry);
  const selected = c.intake_questions ?? [];
  const customQs = selected.filter((q) => !allQs.includes(q));

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-secondary/30 px-4 py-2 text-xs">
        Current industry: <span className="font-semibold text-foreground">{industryLabel(c.industry) ?? "—"}</span>
      </div>
      {/* Greeting */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Greeting</h3>
            <p className="text-xs text-muted-foreground">The first thing every caller hears.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={generateGreetings} disabled={genLoading}>
            {genLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Help me write this
          </Button>
        </div>
        <Textarea
          value={c.greeting ?? ""}
          onChange={(e) => update("greeting", e.target.value)}
          placeholder={`Thanks for calling ${c.business_name}, how can I help you today?`}
          rows={3}
        />
        <div className="flex items-center gap-3 pt-1">
          <TestCallButton clientId={c.id} />
          <p className="text-xs text-muted-foreground">
            Live in-browser preview coming soon — use Test Call to hear the real voice.
          </p>
        </div>
        {options.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tap to use</p>
            {options.map((o, i) => (
              <button key={i} type="button" onClick={() => { update("greeting", o); setOptions([]); }}
                className="w-full text-left rounded-md border border-border bg-secondary/30 hover:bg-secondary p-3 text-sm">
                {o}
              </button>
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <ToggleRow label="Include business name" value={c.include_business_name} onChange={(v) => update("include_business_name", v)} />
          <ToggleRow label="Natural pause / breathing" value={c.human_pause} onChange={(v) => update("human_pause", v)} />
        </div>
      </section>

      {/* Voice */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Voice</h3>
        <p className="text-xs text-muted-foreground">Pick the voice your AI receptionist uses on calls.</p>
        <VoicePicker
          value={String(c.selected_voice_catalog_id ?? c.voice_id ?? "")}
          onChange={(v) => {
            update("selected_voice_catalog_id", v.selected_voice_catalog_id);
            update("voice_provider", v.voice_provider);
            update("voice_provider_voice_id", v.voice_provider_voice_id);
            update("voice_id", v.voice_id);
            update("voice_label", v.voice_label);
            update("voice_sync_status", "pending");
            update("voice_last_sync_error", null);
          }}
        />
        {(c.voice_sync_status !== "synced" || !!c.voice_last_sync_error) && (
          <p className="text-xs text-destructive">
            Voice setup needs attention{c.voice_last_sync_error ? `: ${c.voice_last_sync_error}` : ""}
          </p>
        )}
      </section>

      {/* Intake Questions */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Intake questions</h3>
        <p className="text-xs text-muted-foreground">What your receptionist asks every caller.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {allQs.map((q) => {
            const checked = selected.includes(q);
            const isUniversal = UNIVERSAL_QUESTIONS.includes(q);
            return (
              <label key={q} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={checked} disabled={isUniversal}
                  onChange={(e) => update("intake_questions", e.target.checked ? [...selected, q] : selected.filter((x) => x !== q))} />
                <span>{q}{isUniversal && <span className="text-xs text-muted-foreground ml-1">(always)</span>}</span>
              </label>
            );
          })}
        </div>
        {customQs.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Custom</p>
            <div className="flex flex-wrap gap-2">
              {customQs.map((q) => (
                <span key={q} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm">
                  {q}
                  <button onClick={() => update("intake_questions", selected.filter((x) => x !== q))} className="text-muted-foreground hover:text-foreground">×</button>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Input value={customQ} onChange={(e) => setCustomQ(e.target.value)} placeholder="Add custom question…" />
          <Button type="button" variant="outline" onClick={() => {
            const v = customQ.trim();
            if (!v) return;
            update("intake_questions", [...selected, v]);
            setCustomQ("");
          }}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </section>

      {/* Tone */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold">Tone</h3>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button key={t} type="button" onClick={() => update("tone", t)}
              className={`px-4 py-2 rounded-full text-sm border ${c.tone === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}>
              {t}
            </button>
          ))}
        </div>
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving} className="bg-cta hover:opacity-90 shadow-glow">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save AI Settings
        </Button>
      </div>

      <ServanaHqSettings clientId={c.id} />
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{label}</p>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}