import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, VolumeX } from "lucide-react";
import {
  loadCuratedVoices,
  selectionFromOption,
  type VoiceCatalogOption,
  type VoiceSelection,
} from "@/lib/voiceCatalog";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: VoiceSelection) => void;
};

export default function VoicePicker({ value, onChange }: Props) {
  const [voices, setVoices] = useState<VoiceCatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { voices: list, error } = await loadCuratedVoices();
      if (cancelled) return;
      setVoices(list);
      setLoadError(error ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedId = useMemo(() => {
    if (!value) return "";
    const direct = voices.find((v) => v.id === value)?.id;
    if (direct) return direct;
    return voices.find((v) => v.provider_voice_id === value || v.label.toLowerCase() === value.toLowerCase())?.id ?? "";
  }, [value, voices]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
        Loading voice catalog...
      </div>
    );
  }

  if (voices.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Voice catalog is empty{loadError ? `: ${loadError}` : ""}. Please contact support — no fallback voice will be selected.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Voices below are provider-verified with Vapi. Audio preview is not yet enabled — listen tests will be added in the next update.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {voices.map((v) => {
        const selected = selectedId === v.id;
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
              {v.provider_verified && (
                <Badge variant={selected ? "default" : "secondary"} className="shrink-0">
                  Provider-verified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex-1">{v.description ?? "No description available."}</p>
            <button
              type="button"
              disabled
              title="Audio preview will be enabled once wired to Vapi. Voices are provider-verified but not yet audibly reviewed."
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground cursor-not-allowed"
            >
              <VolumeX className="h-3.5 w-3.5" /> Preview coming soon
            </button>
            <Button
              type="button"
              size="sm"
              variant={selected ? "default" : "secondary"}
              onClick={() => onChange(selectionFromOption(v))}
              className="w-full"
            >
              {selected ? <><Check className="h-4 w-4" /> Selected</> : "Select Voice"}
            </Button>
          </div>
        );
      })}
      </div>
    </div>
  );
}