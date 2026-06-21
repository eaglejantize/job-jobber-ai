import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const PAUSES: { label: string; ms: number }[] = [
  { label: "Short pause", ms: 300 },
  { label: "Medium pause", ms: 600 },
  { label: "Long pause", ms: 1000 },
];

export function GreetingPreview({
  value,
  onChange,
  voice,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  voice?: string;
  rows?: number;
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  function insertAtCursor(snippet: string) {
    const ta = taRef.current;
    if (!ta) {
      onChange((value || "") + snippet);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlaying(false);
  }

  async function play() {
    const text = (value || "").trim();
    if (!text) {
      toast.error("Type a greeting first");
      return;
    }
    if (playing) {
      stop();
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/preview-greeting`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text, speed, voice }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Preview failed (${res.status})`);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const audio = new Audio(objUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); URL.revokeObjectURL(objUrl); };
      audio.onerror = () => { setPlaying(false); URL.revokeObjectURL(objUrl); };
      setPlaying(true);
      await audio.play();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        ref={taRef}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? `Thanks for calling, how can I help you today?`}
      />
      <p className="text-xs text-muted-foreground">
        Tip: insert pauses with <code className="rounded bg-muted px-1">{`<break time="300ms"/>`}</code>. Example:{" "}
        <em>{`Thanks for calling <break time="300ms"/> Roofing Guy. How can I help you today?`}</em>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {PAUSES.map((p) => (
          <Button
            key={p.ms}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => insertAtCursor(` <break time="${p.ms}ms"/> `)}
          >
            + {p.label} ({p.ms}ms)
          </Button>
        ))}
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end pt-1">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Speaking rate</Label>
            <span className="text-xs text-muted-foreground">{speed.toFixed(2)}×</span>
          </div>
          <Slider
            min={0.7}
            max={1.2}
            step={0.05}
            value={[speed]}
            onValueChange={(v) => setSpeed(v[0])}
          />
        </div>
        <Button type="button" onClick={play} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "Stop" : "Preview"}
        </Button>
      </div>
    </div>
  );
}

export default GreetingPreview;