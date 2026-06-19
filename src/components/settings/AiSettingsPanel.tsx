import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Loader2, Play, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { questionsForIndustry, UNIVERSAL_QUESTIONS } from "@/lib/intakeQuestions";

type Voice = { id: string; name: string; provider: string; description: string; previewUrl: string | null };

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
  intake_questions: string[] | null;
  tone: string;
};

export default function AiSettingsPanel({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [c, setC] = useState<ClientRow | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [customQ, setCustomQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data }, voicesRes] = await Promise.all([
        supabase.from("callcapture_clients")
          .select("id, business_name, industry, greeting, include_business_name, human_pause, voice_id, voice_label, intake_questions, tone")
          .eq("id", clientId).maybeSingle(),
        supabase.functions.invoke("list-vapi-voices"),
      ]);
      if (data) {
        const row = data as ClientRow;
        if (!row.intake_questions || row.intake_questions.length === 0) {
          row.intake_questions = questionsForIndustry(row.industry);
        }
        setC(row);
      }
      const v = (voicesRes.data as { voices?: Voice[] } | null)?.voices ?? [];
      setVoices(v);
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

  function previewVoice(v: Voice) {
    if (!v.previewUrl) { toast.info("No preview available"); return; }
    const a = new Audio(v.previewUrl);
    void a.play().catch(() => toast.error("Preview failed to play"));
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
      intake_questions: c.intake_questions as never,
      tone: c.tone,
    }).eq("id", c.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("AI settings saved");
  }

  const allQs = questionsForIndustry(c.industry);
  const selected = c.intake_questions ?? [];
  const customQs = selected.filter((q) => !allQs.includes(q));

  return (
    <div className="space-y-8">
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
        <Textarea rows={3} value={c.greeting ?? ""} onChange={(e) => update("greeting", e.target.value)} placeholder={`Thanks for calling ${c.business_name}, how can I help you today?`} />
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {voices.map((v) => {
            const active = c.voice_id === v.id;
            return (
              <div key={v.id} className={`rounded-lg border p-3 ${active ? "border-emerald-500 bg-emerald-500/5" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.provider}{v.description ? ` · ${v.description}` : ""}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => previewVoice(v)} className="h-7 w-7 shrink-0">
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button type="button" size="sm" variant={active ? "default" : "outline"} className="w-full mt-3"
                  onClick={() => { update("voice_id", v.id); update("voice_label", v.name); }}>
                  {active ? "Selected" : "Use this voice"}
                </Button>
              </div>
            );
          })}
        </div>
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