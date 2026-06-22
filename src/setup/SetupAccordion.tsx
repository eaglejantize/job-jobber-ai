import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { STEPS } from "./schema";
import { useSetupData } from "./useSetupData";
import {
  Step1FindBusiness,
  Step2BusinessDetails,
  Step3PhoneNumber,
  Step4Voice,
  Step5Script,
  Step6CallHandling,
  Step7Notifications,
  Step8Review,
} from "./steps";

const STEP_COMPONENTS = [
  Step1FindBusiness,
  Step2BusinessDetails,
  Step3PhoneNumber,
  Step4Voice,
  Step5Script,
  Step6CallHandling,
  Step7Notifications,
  Step8Review,
];

export default function SetupAccordion() {
  const { loading, data, update, save, clientId, saving } = useSetupData();
  const [open, setOpen] = useState<string>("step-2");

  if (loading) {
    return (
      <div className="container py-20 text-muted-foreground">Loading…</div>
    );
  }

  async function saveAll() {
    const { error } = await save(data);
    if (error) {
      toast({
        title: "Couldn't save",
        description: (error as Error).message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Settings saved" });
    }
  }

  return (
    <div className="container py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6 gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Edit any section. Click Save when you're done.
          </p>
        </div>
        <Button
          onClick={saveAll}
          disabled={saving}
          className="bg-cta hover:opacity-90"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
      </div>

      <Accordion
        type="single"
        collapsible
        value={open}
        onValueChange={(v) => setOpen(v)}
        className="space-y-2"
      >
        {STEPS.map((s, i) => {
          const Comp = STEP_COMPONENTS[i];
          return (
            <AccordionItem
              key={s.id}
              value={`step-${s.id}`}
              className="border border-border rounded-xl bg-card px-4"
            >
              <AccordionTrigger className="text-left">
                <span className="font-medium">
                  {s.id}. {s.short}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <Comp
                  data={data}
                  update={update}
                  save={save}
                  clientId={clientId}
                  mode="settings"
                  onEdit={(step: number) => setOpen(`step-${step}`)}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
