import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PhoneNumberPicker from "@/components/PhoneNumberPicker";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Phone,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { INDUSTRY_OPTIONS, DAYS, type SetupData, type Faq } from "./schema";

type StepProps = {
  data: SetupData;
  update: (patch: Partial<SetupData>) => void;
  save: (
    patch: Partial<SetupData> & { setup_step?: number },
  ) => Promise<{ error: unknown }>;
  clientId: string | null;
  mode: "wizard" | "settings";
};

function StepHelp({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground mb-4">{children}</p>
  );
}

// -------------------- Step 1: Find business --------------------

export function Step1FindBusiness({ data, update, save, mode }: StepProps) {
  const [phone, setPhone] = useState(data.business_phone || "");
  const [searching, setSearching] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [result, setResult] = useState<null | {
    found: boolean;
    business?: {
      business_name: string;
      address: string;
      website: string;
      business_hours: string;
      types: string[];
      phone: string;
    };
    suggestion?: {
      industry_label: string;
      industry_value: string;
      greeting: string;
      intakeQuestions: string[];
    } | null;
  }>(null);
  const [editMode, setEditMode] = useState(false);

  async function searchBusiness() {
    if (!phone.trim()) {
      toast({ title: "Enter your business phone", variant: "destructive" });
      return;
    }
    setSearching(true);
    setResult(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke(
        "business-lookup",
        { body: { phone } },
      );
      if (error) throw error;
      setResult(resp as never);
      if (!(resp as { found?: boolean })?.found) {
        toast({
          title: "No match found",
          description: "Enter your details manually in the next step.",
        });
      }
    } catch (e) {
      toast({
        title: "Lookup failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  }

  async function confirmBusiness() {
    if (!result?.business) return;
    setPrefilling(true);
    const b = result.business;
    const s = result.suggestion;
    const matchedIndustry =
      INDUSTRY_OPTIONS.find(
        (o) =>
          o.label.toLowerCase() === (s?.industry_label || "").toLowerCase(),
      )?.value || "other";

    // Ask AI for full pre-fill (services, after-hours, etc.)
    let extras: {
      after_hours_message?: string;
      services?: string[];
    } = {};
    try {
      const { data: ai } = await supabase.functions.invoke(
        "ai-prefill-setup",
        {
          body: {
            business_name: b.business_name,
            category: s?.industry_label || "",
            hours: b.business_hours,
            address: b.address,
          },
        },
      );
      if (ai) extras = ai as never;
    } catch {
      /* non-fatal */
    }

    const patch: Partial<SetupData> = {
      google_place_id: "",
      google_category: s?.industry_label || "",
      business_name: b.business_name,
      business_phone: b.phone,
      address: b.address,
      website: b.website,
      industry: matchedIndustry,
      greeting: s?.greeting || "",
      services: extras.services ?? [],
      after_hours_message: extras.after_hours_message ?? "",
    };
    update(patch);
    await save({ ...patch, setup_step: 1 });
    setPrefilling(false);
    toast({
      title: "We found your business!",
      description:
        "We pre-configured your AI receptionist. Review the next steps and make changes.",
    });
  }

  return (
    <div className="space-y-4">
      {mode === "wizard" && (
        <StepHelp>
          Let's find your business on Google so we can set everything up for you
          automatically.
        </StepHelp>
      )}

      <div className="space-y-2">
        <Label>Enter your business phone number</Label>
        <div className="flex gap-2">
          <Input
            type="tel"
            inputMode="tel"
            placeholder="(305) 555-1234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button
            type="button"
            onClick={searchBusiness}
            disabled={searching}
            className="bg-cta hover:opacity-90"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </div>
      </div>

      {result?.found && result.business && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{result.business.business_name}</p>
              <p className="text-sm text-muted-foreground">
                {result.business.address}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Phone:</span>{" "}
              {result.business.phone}
            </p>
            {result.suggestion?.industry_label && (
              <p>
                <span className="text-muted-foreground">Category:</span>{" "}
                {result.suggestion.industry_label}
              </p>
            )}
            {result.business.website && (
              <p className="truncate">
                <span className="text-muted-foreground">Website:</span>{" "}
                {result.business.website}
              </p>
            )}
            {result.business.business_hours && (
              <details className="text-muted-foreground">
                <summary className="cursor-pointer text-foreground">
                  Hours
                </summary>
                <pre className="whitespace-pre-wrap text-xs mt-1">
                  {result.business.business_hours}
                </pre>
              </details>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              onClick={confirmBusiness}
              disabled={prefilling}
              className="bg-cta hover:opacity-90"
            >
              {prefilling && <Loader2 className="h-4 w-4 animate-spin" />}
              Yes, that's my business
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditMode(true)}
            >
              Edit details
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setResult(null);
                setPhone("");
              }}
            >
              Search again
            </Button>
          </div>
        </div>
      )}

      {result && !result.found && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
          <span>
            No business found for that number. You can enter your details
            manually in the next step.
          </span>
        </div>
      )}

      {(editMode || data.business_name) && (
        <p className="text-xs text-muted-foreground pt-2">
          You can change anything in the next steps.
        </p>
      )}
    </div>
  );
}

// -------------------- Step 2: Business details --------------------

export function Step2BusinessDetails({ data, update, mode }: StepProps) {
  return (
    <div className="space-y-4">
      {mode === "wizard" && (
        <StepHelp>
          Confirm or edit your business details. These are used in your AI
          receptionist's responses.
        </StepHelp>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Business name"
          value={data.business_name}
          onChange={(v) => update({ business_name: v })}
        />
        <Field
          label="Owner / contact name"
          value={data.owner_name}
          onChange={(v) => update({ owner_name: v })}
        />
        <Field
          label="Business phone number"
          type="tel"
          value={data.business_phone}
          onChange={(v) => update({ business_phone: v })}
        />
        <Field
          label="Business address"
          value={data.address}
          onChange={(v) => update({ address: v })}
        />
        <div className="space-y-2">
          <Label>Business category</Label>
          <Select
            value={data.industry}
            onValueChange={(v) => update({ industry: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field
          label="Website (optional)"
          value={data.website}
          onChange={(v) => update({ website: v })}
        />
      </div>
      <div className="space-y-2 pt-2">
        <Label>Business hours</Label>
        <div className="rounded-xl border border-border divide-y">
          {DAYS.map((d) => {
            const h = data.business_hours_schedule[d] ?? {
              open: "09:00",
              close: "17:00",
              closed: false,
            };
            return (
              <div
                key={d}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="w-10 font-medium">{d}</span>
                <div className="flex items-center gap-2 ml-auto">
                  {!h.closed ? (
                    <>
                      <Input
                        type="time"
                        value={h.open}
                        onChange={(e) =>
                          update({
                            business_hours_schedule: {
                              ...data.business_hours_schedule,
                              [d]: { ...h, open: e.target.value },
                            },
                          })
                        }
                        className="h-8 w-24"
                      />
                      <span>–</span>
                      <Input
                        type="time"
                        value={h.close}
                        onChange={(e) =>
                          update({
                            business_hours_schedule: {
                              ...data.business_hours_schedule,
                              [d]: { ...h, close: e.target.value },
                            },
                          })
                        }
                        className="h-8 w-24"
                      />
                    </>
                  ) : (
                    <span className="text-muted-foreground">Closed</span>
                  )}
                  <div className="flex items-center gap-2 pl-2">
                    <span className="text-xs text-muted-foreground">Closed</span>
                    <Switch
                      checked={h.closed}
                      onCheckedChange={(c) =>
                        update({
                          business_hours_schedule: {
                            ...data.business_hours_schedule,
                            [d]: { ...h, closed: c },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// -------------------- Step 3: Phone number --------------------

export function Step3PhoneNumber({ data, update, clientId, mode }: StepProps) {
  return (
    <div className="space-y-4">
      {mode === "wizard" && (
        <StepHelp>
          This is the dedicated number your customers will call. It connects
          directly to your AI receptionist.
        </StepHelp>
      )}
      <PhoneNumberPicker
        clientId={clientId}
        preferredAreaCode={data.preferred_area_code}
        onAreaCodeChange={(v) => update({ preferred_area_code: v })}
        assignedNumber={data.assigned_callcapture_number}
        numberStatus={data.number_status}
        onProvisioned={(phone, _sid, status) => {
          update({
            assigned_callcapture_number: phone,
            number_status: status,
          });
        }}
      />
    </div>
  );
}

// -------------------- Step 4: Voice --------------------

type VapiVoice = {
  id: string;
  name: string;
  provider: string;
  description: string;
  previewUrl: string | null;
};

export function Step4Voice({ data, update, mode }: StepProps) {
  const [voices, setVoices] = useState<VapiVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: resp } = await supabase.functions.invoke(
          "list-vapi-voices",
          { body: {} },
        );
        const list = (resp as { voices?: VapiVoice[] })?.voices ?? [];
        setVoices(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function playSample(v: VapiVoice) {
    setPlayingId(v.id);
    try {
      // Try Vapi TTS with current tone/speed; fall back to preview URL.
      const { data: resp } = await supabase.functions.invoke(
        "vapi-voice-sample",
        {
          body: {
            voice_id: v.id,
            voice_name: v.name,
            provider: v.provider,
            tone: data.tone,
            speed: data.voice_speed,
            text:
              data.greeting ||
              `Hi, thanks for calling ${data.business_name || "your business"}. How can I help you today?`,
          },
        },
      );
      const url =
        (resp as { audio_url?: string })?.audio_url || v.previewUrl;
      if (url) {
        const audio = new Audio(url);
        audio.onended = () => setPlayingId(null);
        await audio.play();
      } else {
        setPlayingId(null);
        toast({ title: "No preview available for this voice" });
      }
    } catch (e) {
      setPlayingId(null);
      if (v.previewUrl) {
        new Audio(v.previewUrl).play().catch(() => {});
      } else {
        toast({
          title: "Preview failed",
          description: (e as Error).message,
          variant: "destructive",
        });
      }
    }
  }

  return (
    <div className="space-y-5">
      {mode === "wizard" && (
        <StepHelp>
          Pick the voice your customers will hear. You can customize tone and
          speed.
        </StepHelp>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {loading ? (
          <div className="col-span-2 text-sm text-muted-foreground">
            Loading voices…
          </div>
        ) : (
          voices.map((v) => {
            const selected = data.voice_id === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() =>
                  update({ voice_id: v.id, voice_label: v.name })
                }
                className={`text-left rounded-xl border p-3 transition ${
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{v.name}</span>
                  {selected && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
                  {v.description || v.provider}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    playSample(v);
                  }}
                  disabled={playingId === v.id}
                  type="button"
                >
                  {playingId === v.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  Play sample
                </Button>
              </button>
            );
          })
        )}
      </div>

      <div className="space-y-3 pt-2">
        <div className="space-y-2">
          <Label>Tone</Label>
          <RadioGroup
            value={data.tone}
            onValueChange={(v) => update({ tone: v as SetupData["tone"] })}
            className="flex flex-wrap gap-3"
          >
            {(["Professional", "Friendly", "Energetic"] as const).map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer"
              >
                <RadioGroupItem value={t} />
                <span className="text-sm">{t}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Speed</Label>
          <RadioGroup
            value={data.voice_speed}
            onValueChange={(v) =>
              update({ voice_speed: v as SetupData["voice_speed"] })
            }
            className="flex flex-wrap gap-3"
          >
            {(["slow", "normal", "fast"] as const).map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer capitalize"
              >
                <RadioGroupItem value={s} />
                <span className="text-sm">{s}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Rings before AI answers</Label>
          <RadioGroup
            value={String(data.rings_before_answer)}
            onValueChange={(v) =>
              update({ rings_before_answer: Number(v) as 1 | 2 | 3 | 4 })
            }
            className="flex gap-3"
          >
            {[1, 2, 3, 4].map((n) => (
              <label
                key={n}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer"
              >
                <RadioGroupItem value={String(n)} />
                <span className="text-sm">{n}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}

// -------------------- Step 5: Script --------------------

export function Step5Script({ data, update, mode }: StepProps) {
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [newService, setNewService] = useState("");
  const [newFaqQ, setNewFaqQ] = useState("");
  const [newFaqA, setNewFaqA] = useState("");

  async function aiRewrite() {
    if (!rewriteInstruction.trim()) {
      toast({ title: "Tell me how to rewrite it" });
      return;
    }
    setRewriting(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke(
        "ai-rewrite-greeting",
        {
          body: {
            current: data.greeting,
            instruction: rewriteInstruction,
            business_name: data.business_name,
            category: data.google_category || data.industry,
          },
        },
      );
      if (error) throw error;
      const next = (resp as { greeting?: string })?.greeting;
      if (next) {
        update({ greeting: next });
        setRewriteInstruction("");
        toast({ title: "Greeting updated" });
      }
    } catch (e) {
      toast({
        title: "Rewrite failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setRewriting(false);
    }
  }

  async function preview() {
    setPreviewing(true);
    try {
      const { data: resp } = await supabase.functions.invoke(
        "vapi-voice-sample",
        {
          body: {
            voice_id: data.voice_id,
            voice_name: data.voice_label,
            tone: data.tone,
            speed: data.voice_speed,
            text: data.greeting,
          },
        },
      );
      const url = (resp as { audio_url?: string })?.audio_url;
      if (url) {
        const audio = new Audio(url);
        audio.onended = () => setPreviewing(false);
        await audio.play();
      } else {
        setPreviewing(false);
        toast({ title: "Preview not available right now" });
      }
    } catch (e) {
      setPreviewing(false);
      toast({
        title: "Preview failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  async function resetDefault() {
    try {
      const { data: ai } = await supabase.functions.invoke(
        "ai-prefill-setup",
        {
          body: {
            business_name: data.business_name,
            category: data.google_category || data.industry,
            hours: "",
          },
        },
      );
      const greeting = (ai as { greeting?: string })?.greeting;
      if (greeting) update({ greeting });
    } catch {
      update({
        greeting: `Thank you for calling ${data.business_name || "us"}! How can I help you today?`,
      });
    }
  }

  return (
    <div className="space-y-5">
      {mode === "wizard" && (
        <StepHelp>
          This is what your AI says when it answers. We've drafted a custom
          script — make it your own.
        </StepHelp>
      )}

      <div className="space-y-2">
        <Label>Greeting</Label>
        <Textarea
          rows={3}
          value={data.greeting}
          onChange={(e) => update({ greeting: e.target.value })}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={preview}
            disabled={previewing || !data.greeting}
          >
            {previewing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Preview
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={resetDefault}
          >
            <RotateCcw className="h-3 w-3" /> Reset to default
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <Label>AI Rewrite</Label>
        <div className="flex gap-2">
          <Input
            placeholder='e.g. "make it more friendly"'
            value={rewriteInstruction}
            onChange={(e) => setRewriteInstruction(e.target.value)}
          />
          <Button
            type="button"
            onClick={aiRewrite}
            disabled={rewriting}
            className="bg-cta hover:opacity-90"
          >
            {rewriting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Rewrite
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>After-hours message</Label>
        <Textarea
          rows={2}
          value={data.after_hours_message}
          onChange={(e) => update({ after_hours_message: e.target.value })}
          placeholder="What the AI says when you're closed."
        />
      </div>

      <div className="space-y-2">
        <Label>Services the AI knows about</Label>
        <div className="flex flex-wrap gap-2">
          {data.services.map((s) => (
            <Badge
              key={s}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {s}
              <button
                type="button"
                onClick={() =>
                  update({ services: data.services.filter((x) => x !== s) })
                }
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add a service…"
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (newService.trim()) {
                  update({ services: [...data.services, newService.trim()] });
                  setNewService("");
                }
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (newService.trim()) {
                update({ services: [...data.services, newService.trim()] });
                setNewService("");
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Common FAQs the AI can answer</Label>
        <div className="space-y-2">
          {data.faqs.map((f, i) => (
            <div
              key={i}
              className="rounded-md border border-border p-2 text-sm space-y-1"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{f.q}</p>
                <button
                  type="button"
                  onClick={() =>
                    update({ faqs: data.faqs.filter((_, j) => j !== i) })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <p className="text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input
            placeholder="Question"
            value={newFaqQ}
            onChange={(e) => setNewFaqQ(e.target.value)}
          />
          <Input
            placeholder="Answer"
            value={newFaqA}
            onChange={(e) => setNewFaqA(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (newFaqQ.trim() && newFaqA.trim()) {
              const faqs: Faq[] = [
                ...data.faqs,
                { q: newFaqQ.trim(), a: newFaqA.trim() },
              ];
              update({ faqs });
              setNewFaqQ("");
              setNewFaqA("");
            }
          }}
        >
          <Plus className="h-4 w-4" /> Add FAQ
        </Button>
      </div>
    </div>
  );
}

// -------------------- Step 6: Call handling --------------------

export function Step6CallHandling({ data, update, mode }: StepProps) {
  return (
    <div className="space-y-4">
      {mode === "wizard" && (
        <StepHelp>
          Configure what happens when a caller needs to speak to a real person.
        </StepHelp>
      )}
      <Field
        label="Call forwarding number"
        type="tel"
        value={data.forward_phone}
        onChange={(v) => update({ forward_phone: v })}
        placeholder="(305) 555-1234"
      />
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <Label className="m-0">Voicemail fallback</Label>
        <Switch
          checked={data.voicemail_fallback}
          onCheckedChange={(v) => update({ voicemail_fallback: v })}
        />
      </div>
      <div className="space-y-2">
        <Label>After-hours behavior</Label>
        <RadioGroup
          value={data.after_hours_mode}
          onValueChange={(v) =>
            update({ after_hours_mode: v as SetupData["after_hours_mode"] })
          }
          className="space-y-2"
        >
          {[
            { v: "voicemail", l: "Forward to voicemail" },
            { v: "forward", l: "Forward to number" },
            { v: "ai", l: "AI handles it" },
          ].map((o) => (
            <label
              key={o.v}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer"
            >
              <RadioGroupItem value={o.v} />
              <span className="text-sm">{o.l}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}

// -------------------- Step 7: Notifications --------------------

const NOTIFY_OPTIONS = [
  { v: "new_call", l: "New call" },
  { v: "new_booking", l: "New booking" },
  { v: "missed_call", l: "Missed call" },
  { v: "all_activity", l: "All activity" },
] as const;

export function Step7Notifications({ data, update, mode }: StepProps) {
  const n = data.notification_settings;
  const setN = (patch: Partial<SetupData["notification_settings"]>) =>
    update({ notification_settings: { ...n, ...patch } });

  return (
    <div className="space-y-4">
      {mode === "wizard" && (
        <StepHelp>
          Get notified instantly when your AI takes a call or books an
          appointment.
        </StepHelp>
      )}
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <Label className="m-0">SMS notifications</Label>
        <Switch
          checked={n.sms_enabled}
          onCheckedChange={(v) => setN({ sms_enabled: v })}
        />
      </div>
      {n.sms_enabled && (
        <Field
          label="Notification phone number"
          type="tel"
          value={n.sms_phone}
          onChange={(v) => setN({ sms_phone: v })}
        />
      )}
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <Label className="m-0">Email notifications</Label>
        <Switch
          checked={n.email_enabled}
          onCheckedChange={(v) => setN({ email_enabled: v })}
        />
      </div>
      {n.email_enabled && (
        <Field
          label="Notification email"
          type="email"
          value={n.email}
          onChange={(v) => setN({ email: v })}
        />
      )}
      <div className="space-y-2">
        <Label>Notify on</Label>
        <div className="grid sm:grid-cols-2 gap-2">
          {NOTIFY_OPTIONS.map((o) => {
            const checked = n.notify_on.includes(o.v);
            return (
              <label
                key={o.v}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setN({
                      notify_on: e.target.checked
                        ? [...n.notify_on, o.v]
                        : n.notify_on.filter((x) => x !== o.v),
                    })
                  }
                />
                <span className="text-sm">{o.l}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// -------------------- Step 8: Review --------------------

export function Step8Review({
  data,
  onEdit,
  mode,
}: StepProps & { onEdit?: (step: number) => void }) {
  const sections: { title: string; step: number; rows: [string, string][] }[] = [
    {
      title: "Business info",
      step: 2,
      rows: [
        ["Name", data.business_name || "—"],
        ["Owner", data.owner_name || "—"],
        ["Phone", data.business_phone || "—"],
        ["Address", data.address || "—"],
        [
          "Category",
          INDUSTRY_OPTIONS.find((o) => o.value === data.industry)?.label || "—",
        ],
        ["Website", data.website || "—"],
      ],
    },
    {
      title: "Vektuor phone number",
      step: 3,
      rows: [
        ["Number", data.assigned_callcapture_number || "Not provisioned"],
        ["Status", data.number_status || "—"],
      ],
    },
    {
      title: "Voice settings",
      step: 4,
      rows: [
        ["Voice", data.voice_label || "—"],
        ["Tone", data.tone],
        ["Speed", data.voice_speed],
        ["Rings before AI", String(data.rings_before_answer)],
      ],
    },
    {
      title: "Greeting script",
      step: 5,
      rows: [["Greeting", data.greeting || "—"]],
    },
    {
      title: "Call forwarding",
      step: 6,
      rows: [
        ["Forward to", data.forward_phone || "—"],
        ["Voicemail fallback", data.voicemail_fallback ? "Yes" : "No"],
        ["After-hours", data.after_hours_mode],
      ],
    },
    {
      title: "Notifications",
      step: 7,
      rows: [
        ["SMS", data.notification_settings.sms_enabled ? data.notification_settings.sms_phone || "On" : "Off"],
        ["Email", data.notification_settings.email_enabled ? data.notification_settings.email || "On" : "Off"],
        ["Notify on", data.notification_settings.notify_on.join(", ") || "—"],
      ],
    },
  ];
  return (
    <div className="space-y-4">
      {mode === "wizard" && (
        <StepHelp>
          Review everything below. Press <strong>Launch</strong> when you're
          ready to go live.
        </StepHelp>
      )}
      {sections.map((s) => (
        <div key={s.title} className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{s.title}</h3>
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => onEdit(s.step)}
              >
                Edit
              </Button>
            )}
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-sm">
            {s.rows.map(([k, v]) => (
              <Fragment key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-words whitespace-pre-wrap">{v}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

// -------------------- Field helper --------------------

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export const STEP_COMPONENTS = [
  Step1FindBusiness,
  Step2BusinessDetails,
  Step3PhoneNumber,
  Step4Voice,
  Step5Script,
  Step6CallHandling,
  Step7Notifications,
  Step8Review,
];
