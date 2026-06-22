import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

function formatUS(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export default function PhoneNumberPicker({
  clientId,
  preferredAreaCode,
  onAreaCodeChange,
  assignedNumber,
  numberStatus,
  onProvisioned,
}: {
  clientId: string | null;
  preferredAreaCode: string;
  onAreaCodeChange: (v: string) => void;
  assignedNumber: string | null;
  numberStatus: string | null;
  onProvisioned: (phone: string, sid: string, status: string) => void;
}) {
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [preferredAreaCode]);

  async function provision() {
    setError(null);
    if (!/^\d{3}$/.test(preferredAreaCode)) {
      toast({ title: "Enter a 3-digit area code", variant: "destructive" });
      return;
    }
    if (!clientId) {
      toast({
        title: "Account not ready",
        description: "Complete signup before reserving a number.",
        variant: "destructive",
      });
      return;
    }
    setProvisioning(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "provision-vapi-number",
        { body: { area_code: preferredAreaCode, client_id: clientId } },
      );
      const d = (data ?? {}) as any;
      const errMsg = d?.error ?? invokeError?.message;
      if (errMsg) throw new Error(errMsg);
      onProvisioned(d.phone_number, d.id, d.status ?? "active");
      toast({ title: "Number active", description: d.message ?? "Your Vektuor number is active." });
    } catch (e) {
      const msg = (e as Error).message || "Provisioning failed";
      setError(msg);
      toast({ title: "Couldn't get a number", description: msg, variant: "destructive" });
    } finally {
      setProvisioning(false);
    }
  }

  // Already provisioned view
  if (assignedNumber) {
    const isActive = numberStatus === "active";
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Your Vektuor number</p>
              <p className="text-xl font-semibold mt-1">{formatUS(assignedNumber)}</p>
              <div className="mt-2">
                <Badge variant={isActive ? "default" : "secondary"}>
                  {isActive ? "Active" : "Needs Configuration"}
                </Badge>
              </div>
              {!isActive && (
                <p className="text-xs text-muted-foreground mt-2">
                  Number reserved. Final call routing is being configured.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="space-y-2 flex-1 max-w-xs">
          <Label>Preferred area code</Label>
          <Input
            inputMode="numeric"
            maxLength={3}
            placeholder="Preferred area code"
            value={preferredAreaCode}
            onChange={(e) => onAreaCodeChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
        </div>
        <Button
          onClick={provision}
          disabled={provisioning || preferredAreaCode.length !== 3}
          type="button"
          className="bg-cta hover:opacity-90"
        >
          {provisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          Get My Vektuor Number
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}