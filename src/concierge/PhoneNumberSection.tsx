import { useState } from "react";
import PhoneNumberPicker from "@/components/PhoneNumberPicker";
import { supabase } from "@/integrations/supabase/client";
import type { UseConcierge } from "./useConcierge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function PhoneNumberSection({ ctx }: { ctx: UseConcierge }) {
  const [replacing, setReplacing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const assigned = (ctx.current as any)?.assigned_callcapture_number ?? null;
  const status = (ctx.current as any)?.number_status ?? null;
  const webhookStatus = (ctx.current as any)?.webhook_status ?? null;
  const routingError = (ctx.current as any)?.last_vapi_sync_status ?? null;
  const preferred = String((ctx.current as any)?.preferred_area_code ?? "");
  const [areaCode, setAreaCode] = useState(preferred);

  const showAssigned = assigned && !replacing;

  return (
    <div className="space-y-3">
      {!showAssigned && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
          Choose one of the options below to connect a business phone number before continuing setup.
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
            await supabase.functions.invoke("repair-routing", {
              body: { client_id: ctx.clientId },
            });
          } finally {
            setRepairing(false);
            await ctx.reload();
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
              } as never)
              .eq("id", ctx.clientId);
          }
          setReplacing(false);
          await ctx.reload();
        }}
      />
    </div>
  );
}