import { useState } from "react";
import PhoneNumberPicker from "@/components/PhoneNumberPicker";
import { supabase } from "@/integrations/supabase/client";
import type { UseConcierge } from "./useConcierge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { derivePhoneLifecycle, describePhoneLifecycle } from "@/onboarding/status";

export default function PhoneNumberSection({ ctx }: { ctx: UseConcierge }) {
  const [replacing, setReplacing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const assigned = ctx.current?.assigned_callcapture_number ?? null;
  const status = ctx.current?.number_status ?? null;
  const webhookStatus = ctx.current?.webhook_status ?? null;
  const routingError = ctx.current?.last_vapi_sync_status ?? null;
  const preferred = String(ctx.current?.preferred_area_code ?? "");
  const [areaCode, setAreaCode] = useState(preferred);

  const showAssigned = assigned && !replacing;
  const lifecycle = derivePhoneLifecycle(
    ctx.current as unknown as Record<string, unknown> | null | undefined,
  );
  const lifecycleTone: Record<typeof lifecycle.state, string> = {
    not_started: "border-amber-500/30 bg-amber-500/10",
    configured: "border-sky-500/30 bg-sky-500/10",
    pending_provisioning: "border-sky-500/30 bg-sky-500/10",
    ready: "border-emerald-500/30 bg-emerald-500/10",
    error: "border-destructive/40 bg-destructive/10",
  };

  return (
    <div className="space-y-3">
      {assigned && (
        <div className={`rounded-lg border p-3 text-sm text-foreground ${lifecycleTone[lifecycle.state]}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">
                Vektuor AI Phone Number — <span className="uppercase text-xs tracking-wide">{lifecycle.state.replace(/_/g, " ")}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{describePhoneLifecycle(lifecycle)}</p>
              {lifecycle.state !== "ready" && lifecycle.missing.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Pending: {lifecycle.missing.join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {!showAssigned && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
          Choose one of the options below to connect a Vektuor AI phone number for call capture. This is separate from your existing Business Phone Number.
        </div>
      )}
      {showAssigned && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setReplacing(true)}
          >
            <RefreshCw className="h-3 w-3" /> Replace number
          </Button>
        </div>
      )}
      <PhoneNumberPicker
        clientId={ctx.clientId}
        preferredAreaCode={areaCode}
        onAreaCodeChange={setAreaCode}
        assignedNumber={showAssigned ? assigned : null}
        numberStatus={showAssigned ? status : null}
        webhookStatus={showAssigned ? webhookStatus : null}
        routingError={showAssigned ? routingError : null}
        onRefresh={ctx.reload}
        onRetryRepair={async () => {
          if (!ctx.clientId) return;
          setRepairing(true);
          try {
            const { data, error } = await supabase.functions.invoke("repair-routing", {
              body: { client_id: ctx.clientId },
            });
            const d = (data ?? {}) as { ok?: boolean; error?: string; status?: string };
            if (error || d?.error) {
              toast({
                title: "Routing repair failed",
                description: d?.error || error?.message || "Could not repair routing.",
                variant: "destructive",
              });
            } else if (d?.status === "active") {
              toast({ title: "Routing configured", description: "Your number is ready for inbound calls." });
            }
          } finally {
            setRepairing(false);
            await ctx.reload();
            window.dispatchEvent(new CustomEvent("setup:reload"));
          }
        }}
        retryingRepair={repairing}
        onProvisioned={async (phone, _sid, newStatus) => {
          if (ctx.clientId) {
            await supabase
              .from("callcapture_clients")
              .update({
                assigned_callcapture_number: phone,
                number_status: newStatus,
              })
              .eq("id", ctx.clientId);
          }
          setReplacing(false);
          await ctx.reload();
          window.dispatchEvent(new CustomEvent("setup:reload"));
        }}
      />
    </div>
  );
}