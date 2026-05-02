import { useEffect, useMemo, useState } from "react";
import { Phone, Copy, PhoneCall, Check, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { DEMO_NUMBER, DEMO_NUMBER_TEL } from "@/lib/constants";
import {
  VAPI_VOICES,
  type VapiVoiceOption,
  loadVoiceSelection,
  saveVoiceSelection,
  loadGuidedTestMode,
  saveGuidedTestMode,
} from "@/lib/vapiVoices";

type Props = {
  businessPhone: string | null;
  status: string;
};

const GUIDED_PROMPTS = [
  "My dryer isn't heating",
  "I need service tomorrow",
  "This is a recall job",
];

function telHref(num: string): string {
  const digits = num.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+1${digits.replace(/^1/, "")}`;
}

export default function VoiceTestSection({ businessPhone, status }: Props) {
  const [selectedId, setSelectedId] = useState<string>(() => loadVoiceSelection().selected_voice_id);
  const [guided, setGuided] = useState<boolean>(() => loadGuidedTestMode());

  const selected = useMemo<VapiVoiceOption>(
    () => VAPI_VOICES.find((v) => v.id === selectedId) ?? VAPI_VOICES[0],
    [selectedId],
  );

  useEffect(() => {
    saveVoiceSelection(selected);
  }, [selected]);

  useEffect(() => {
    saveGuidedTestMode(guided);
  }, [guided]);

  const isLive = status === "Live" || status === "Ready";
  const phoneToCall = businessPhone || DEMO_NUMBER;
  const isDemoFallback = !businessPhone;

  function handlePreview(voice: VapiVoiceOption) {
    toast({
      title: "Preview coming soon",
      description: `Live samples for ${voice.displayName} will be available shortly. Use "Call My AI" to hear your assistant on a real call.`,
    });
  }

  function copyNumber() {
    navigator.clipboard.writeText(phoneToCall).then(() => {
      toast({ title: "Number copied", description: phoneToCall });
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-lg font-semibold">Test Your AI Receptionist</h2>
          <p className="text-sm text-muted-foreground">
            Call or listen to your assistant before going live.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            isLive
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isLive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
            }`}
          />
          {isLive ? "Live — Calls Active" : "Setup in progress"}
        </span>
      </div>

      {/* Part 1+2: Voice selection grid */}
      <div className="mt-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Choose a voice
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {VAPI_VOICES.map((v) => {
            const active = v.id === selectedId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`text-left rounded-xl border p-4 transition-all ${
                  active
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "border-border hover:border-primary/40 bg-background"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{v.displayName}</div>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{v.toneLabel}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(v);
                  }}
                >
                  <Play className="h-3.5 w-3.5" /> Play Sample
                </Button>
                <p className="text-[10px] text-muted-foreground/80 mt-2 text-center">
                  Preview coming soon
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Part 3: Test call */}
      <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Your AI Phone Number
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <a
            href={`tel:${telHref(phoneToCall)}`}
            className="text-2xl md:text-3xl font-bold tracking-wider tabular-nums hover:text-primary transition-colors"
          >
            {phoneToCall}
          </a>
          {isDemoFallback && (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              demo
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button asChild className="bg-cta hover:opacity-90 shadow-glow flex-1">
            <a href={`tel:${telHref(phoneToCall)}`}>
              <PhoneCall className="h-4 w-4" /> Call My AI
            </a>
          </Button>
          <Button variant="outline" onClick={copyNumber}>
            <Copy className="h-4 w-4" /> Copy Number
          </Button>
        </div>
      </div>

      {/* Part 4: Guided test mode */}
      <div className="mt-5 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Guided Test Mode</p>
              <p className="text-xs text-muted-foreground">
                Get example things to say when you call.
              </p>
            </div>
          </div>
          <Switch checked={guided} onCheckedChange={setGuided} aria-label="Guided test mode" />
        </div>
        {guided && (
          <div className="mt-4 rounded-lg border border-dashed border-primary/40 bg-background p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Try saying:
            </p>
            <ul className="space-y-1.5">
              {GUIDED_PROMPTS.map((p) => (
                <li key={p} className="text-sm flex items-start gap-2">
                  <Phone className="h-3.5 w-3.5 text-primary mt-1 shrink-0" />
                  <span>"{p}"</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
