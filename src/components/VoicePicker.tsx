import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Check } from "lucide-react";
import { VOICES, type VoicePersona } from "@/lib/voices";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: VoicePersona) => void;
};

export default function VoicePicker({ value, onChange }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  function play(v: VoicePersona) {
    if (errorIds.has(v.id)) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (playingId === v.id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(v.previewUrl);
    audioRef.current = audio;
    audio.onended = () => setPlayingId((p) => (p === v.id ? null : p));
    audio.onerror = () => {
      setErrorIds((s) => new Set(s).add(v.id));
      setPlayingId(null);
    };
    audio.play().then(() => setPlayingId(v.id)).catch(() => {
      setErrorIds((s) => new Set(s).add(v.id));
      setPlayingId(null);
    });
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {VOICES.map((v) => {
        const selected = value === v.id;
        const isPlaying = playingId === v.id;
        const missing = errorIds.has(v.id);
        return (
          <div
            key={v.id}
            className={cn(
              "rounded-xl border p-4 flex flex-col gap-3 transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary/30",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold leading-tight">{v.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{v.persona}</p>
              </div>
              {v.badge && (
                <Badge variant={selected ? "default" : "secondary"} className="shrink-0">
                  {v.badge}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex-1">{v.description}</p>
            {missing ? (
              <p className="text-xs text-muted-foreground italic">Preview audio not uploaded yet.</p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => play(v)}
                className="w-full"
              >
                {isPlaying ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Play Preview</>}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant={selected ? "default" : "secondary"}
              onClick={() => onChange(v)}
              className="w-full"
              disabled={selected}
            >
              {selected ? <><Check className="h-4 w-4" /> Selected</> : "Select Voice"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}