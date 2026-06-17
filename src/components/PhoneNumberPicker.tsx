import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type AvailableNumber = {
  phone_number: string;
  friendly_name: string;
  locality: string | null;
  region: string | null;
};

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
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AvailableNumber[] | null>(null);
  const [selected, setSelected] = useState<AvailableNumber | null>(null);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
    setResults(null);
  }, [preferredAreaCode]);

  async function search() {
    setError(null);
    if (!/^\d{3}$/.test(preferredAreaCode)) {
      toast({ title: "Enter a 3-digit area code", variant: "destructive" });
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-twilio-numbers", {
        body: { area_code: preferredAreaCode },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const nums = ((data as any)?.numbers ?? []) as AvailableNumber[];
      setResults(nums);
      if (!nums.length) toast({ title: "No numbers available", description: "Try a different area code." });
    } catch (e) {
      setError((e as Error).message);
      toast({ title: "Search failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  async function reserve() {
    if (!selected) return;
    if (!clientId) {
      toast({ title: "Account not ready", description: "Complete signup before reserving a number.", variant: "destructive" });
      return;
    }
    setReserving(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("provision-twilio-number", {
        body: { phone_number: selected.phone_number, client_id: clientId },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      onProvisioned(d.phone_number, d.sid, d.status);
      toast({ title: "Number reserved", description: d.message ?? "Your Vektuor number is set." });
      setResults(null);
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
      toast({ title: "Couldn't reserve number", description: (e as Error).message, variant: "destructive" });
    } finally {
      setReserving(false);
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
            placeholder="904"
            value={preferredAreaCode}
            onChange={(e) => onAreaCodeChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
        </div>
        <Button onClick={search} disabled={searching || preferredAreaCode.length !== 3} type="button">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          Find Available Numbers
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {results.map((n) => {
            const active = selected?.phone_number === n.phone_number;
            return (
              <button
                key={n.phone_number}
                type="button"
                onClick={() => setSelected(n)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                }`}
              >
                <p className="font-semibold">{formatUS(n.phone_number)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {[n.locality, n.region].filter(Boolean).join(", ") || "United States"}
                </p>
                <p className="text-xs mt-2 font-medium text-primary">
                  {active ? "Selected" : "Select Number"}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground">Selected</p>
            <p className="font-semibold">{formatUS(selected.phone_number)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={() => setSelected(null)}>
              Pick a different one
            </Button>
            <Button onClick={reserve} disabled={reserving} type="button" className="bg-cta hover:opacity-90">
              {reserving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Reserve This Number
            </Button>
          </div>
        </div>
      )}

      {results && results.length === 0 && !searching && (
        <p className="text-sm text-muted-foreground">No numbers available for that area code. Try another.</p>
      )}
    </div>
  );
}