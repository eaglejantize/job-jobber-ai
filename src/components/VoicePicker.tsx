import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { VOICES, type VoicePersona } from "@/lib/voices";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: VoicePersona) => void;
};

export default function VoicePicker({ value, onChange }: Props) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {VOICES.map((v) => {
        const selected = value === v.id;
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
            <span className="inline-flex w-full items-center justify-center rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
              Preview coming soon
            </span>
            <Button
              type="button"
              size="sm"
              variant={selected ? "default" : "secondary"}
              onClick={() => onChange(v)}
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