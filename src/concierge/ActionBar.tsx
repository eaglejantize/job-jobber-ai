import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, Briefcase, Heart, Tag, MapPin, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
type Action = "generate" | "improve" | "professional" | "warmer" | "industry" | "gbp";

type ActionIcon = ComponentType<{ className?: string }>;
type ConciergeGenerateResponse = {
  error?: string;
  needs_user_input?: boolean;
  notes?: string;
  value?: unknown;
};

const BUTTONS: { id: Action; label: string; icon: ActionIcon }[] = [
  { id: "generate", label: "Generate for me", icon: Sparkles },
  { id: "improve", label: "Improve this", icon: Wand2 },
  { id: "professional", label: "More professional", icon: Briefcase },
  { id: "warmer", label: "Make it warmer", icon: Heart },
  { id: "industry", label: "Use my industry", icon: Tag },
  { id: "gbp", label: "Use Google Business data", icon: MapPin },
];

export default function ActionBar({
  section,
  currentValue,
  onResult,
  disableGbp,
  notes,
}: {
  section: string;
  currentValue: unknown;
  onResult: (value: unknown, meta?: { needs_user_input?: boolean; notes?: string }) => void;
  disableGbp?: boolean;
  notes?: string;
}) {
  const [busy, setBusy] = useState<Action | null>(null);

  async function run(action: Action) {
    setBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke("concierge-generate", {
        body: { section, action, currentValue, userNotes: notes ?? "" },
      });
      if (error) throw error;
      if (!data) throw new Error("No response");
      const result = data as ConciergeGenerateResponse;
      if (result.error) throw new Error(result.error);
      if (result.needs_user_input) {
        toast({
          title: "Need a bit more info",
          description: result.notes || "Please fill this in manually.",
        });
      }
      onResult(result.value, {
        needs_user_input: result.needs_user_input,
        notes: result.notes,
      });
    } catch (e) {
      toast({
        title: "Couldn't generate",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {BUTTONS.map((b) => {
        const Icon = b.icon;
        const isDisabled = (b.id === "gbp" && disableGbp) || busy !== null;
        return (
          <Button
            key={b.id}
            size="sm"
            variant="secondary"
            disabled={isDisabled}
            onClick={() => run(b.id)}
            type="button"
          >
            {busy === b.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {b.label}
          </Button>
        );
      })}
    </div>
  );
}