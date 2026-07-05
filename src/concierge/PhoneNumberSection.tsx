import { useState } from "react";
import PhoneNumberPicker from "@/components/PhoneNumberPicker";
import { supabase } from "@/integrations/supabase/client";
import type { UseConcierge } from "./useConcierge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function PhoneNumberSection({ ctx }: { ctx: UseConcierge }) {
  const [replacing, setReplacing] = useState(false);
  const assigned = (ctx.current as any)?.assigned_callcapture_number ?? null;
  const status = (ctx.current as any)?.number_status ?? null;
  const preferred = String((ctx.current as any)?.preferred_area_code ?? "");
  const [areaCode, setAreaCode] = useState(preferred);

  const showAssigned = assigned && !replacing;

  return (
    <div className="space-y-3">
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