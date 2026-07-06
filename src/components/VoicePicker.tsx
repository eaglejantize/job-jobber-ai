import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { voices: list } = await loadCuratedVoices();
      if (cancelled) return;
      setVoices(list);
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

  return (
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
                <p className="text-xs text-muted-foreground mt-0.5">{v.persona} · {v.customer_category}</p>
              </div>
              {v.verified_active && (
                <Badge variant={selected ? "default" : "secondary"} className="shrink-0">
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex-1">{v.description ?? "No description available."}</p>
            {v.preview_url ? (
              <audio controls preload="none" className="w-full h-8">
                <source src={v.preview_url} />
              </audio>
            ) : (
              <span className="inline-flex w-full items-center justify-center rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                Preview unavailable
              </span>
            )}
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
  );
}