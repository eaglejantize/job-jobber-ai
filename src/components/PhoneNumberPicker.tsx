import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Phone, CheckCircle2, AlertTriangle, PhoneForwarded, Sparkles, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

function formatUS(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

type Available = {
  phone_number: string;
  friendly_name?: string;
  locality?: string | null;
  region?: string | null;
};

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
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Available[]>([]);
  const [nearby, setNearby] = useState<Available[]>([]);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [byoPhone, setByoPhone] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [preferredAreaCode]);

  function ensureClient(): boolean {
    if (!clientId) {
      toast({
        title: "Account not ready",
        description: "Complete signup before connecting a number.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  }

  function reportError(d: any, fallback: string) {
    const map: Record<string, string> = {
      missing_secret: "Vektuor's phone provider isn't configured. Please contact support.",
      twilio_auth_failed: "Twilio authentication failed. Please contact support.",
      no_numbers: "No phone numbers available for that area code.",
      purchase_failed: "Couldn't purchase that number — try another one.",
      bad_request: d?.error ?? "Invalid request.",
      not_found: "Account not found.",
      db_error: "Saved the number but the database update failed. Contact support.",
    };
    const msg = map[d?.error_code] ?? d?.error ?? fallback;
    setError(msg);
    toast({ title: "Phone setup", description: msg, variant: "destructive" });
  }

  async function searchNumbers() {
    setError(null);
    setNumbers([]);
    setNearby([]);
    setFallbackReason(null);
    if (!/^\d{3}$/.test(preferredAreaCode)) {
      toast({ title: "Enter a 3-digit area code", variant: "destructive" });
      return;
    }
    setSearching(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "search-twilio-numbers",
        { body: { area_code: preferredAreaCode } },
      );
      const d = (data ?? {}) as any;
      if (invokeError || d?.error_code) {
        reportError(d, invokeError?.message ?? "Search failed");
        return;
      }
      setNumbers(d.numbers ?? []);
      setNearby(d.nearby ?? []);
      setFallbackReason(d.fallback_reason ?? null);
      if ((d.numbers ?? []).length === 0 && (d.nearby ?? []).length === 0) {
        setError("No numbers available right now. Try a different area code or use a fallback below.");
      }
    } catch (e) {
      reportError({}, (e as Error).message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function purchase(num: string) {
    if (!ensureClient()) return;
    setPurchasing(num);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "provision-twilio-number",
        { body: { phone_number: num, client_id: clientId } },
      );
      const d = (data ?? {}) as any;
      if (invokeError || d?.error_code) {
        reportError(d, invokeError?.message ?? "Purchase failed");
        return;
      }
      onProvisioned(d.phone_number, d.sid, d.status ?? "active");
      toast({
        title: d.status === "active" ? "Number active" : "Number reserved",
        description: d.message ?? "Your Vektuor number is set up.",
      });
    } catch (e) {
      reportError({}, (e as Error).message);
    } finally {
      setPurchasing(null);
    }
  }

  async function linkExisting(mode: "byo" | "forward" | "test") {
    if (!ensureClient()) return;
    setBusyAction(mode);
    setError(null);
    try {
      const body: Record<string, unknown> = { mode, client_id: clientId };
      if (mode !== "test") body.phone_number = byoPhone;
      const { data, error: invokeError } = await supabase.functions.invoke(
        "link-existing-number",
        { body },
      );
      const d = (data ?? {}) as any;
      if (invokeError || d?.error_code) {
        reportError(d, invokeError?.message ?? "Failed to link number");
        return;
      }
      onProvisioned(d.phone_number, "", d.status ?? "pending_forwarding");
      toast({ title: "Number linked", description: d.message });
    } catch (e) {
      reportError({}, (e as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  // Already provisioned view
  if (assignedNumber) {
    const isActive = numberStatus === "active";
    const labelMap: Record<string, string> = {
      active: "Active",
      needs_configuration: "Needs Configuration",
      pending_forwarding: "Pending Forwarding",
      test: "Test Number",
    };
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
                  {labelMap[numberStatus ?? ""] ?? "Reserved"}
                </Badge>
              </div>
              {!isActive && (
                <p className="text-xs text-muted-foreground mt-2">
                  Number saved. Routing setup will be completed shortly.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const numberRow = (n: Available) => (
    <div
      key={n.phone_number}
      className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
    >
      <div>
        <p className="font-medium">{formatUS(n.phone_number)}</p>
        <p className="text-xs text-muted-foreground">
          {[n.locality, n.region].filter(Boolean).join(", ") || n.friendly_name || "US Local"}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => purchase(n.phone_number)}
        disabled={purchasing === n.phone_number}
      >
        {purchasing === n.phone_number ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Choose"
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          <TabsTrigger value="new"><Sparkles className="h-3 w-3 mr-1" />New number</TabsTrigger>
          <TabsTrigger value="byo"><Phone className="h-3 w-3 mr-1" />I have one</TabsTrigger>
          <TabsTrigger value="forward"><PhoneForwarded className="h-3 w-3 mr-1" />Forward</TabsTrigger>
          <TabsTrigger value="test">Test number</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-3 pt-3">
          <div className="flex items-end gap-2">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label>Preferred area code</Label>
              <Input
                inputMode="numeric"
                maxLength={3}
                placeholder="e.g. 305"
                value={preferredAreaCode}
                onChange={(e) =>
                  onAreaCodeChange(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
              />
            </div>
            <Button
              type="button"
              onClick={searchNumbers}
              disabled={searching || preferredAreaCode.length !== 3}
              className="bg-cta hover:opacity-90"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search numbers
            </Button>
          </div>

          {numbers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Available in {preferredAreaCode}
              </p>
              {numbers.map(numberRow)}
            </div>
          )}

          {numbers.length === 0 && nearby.length > 0 && (
            <div className="space-y-2">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                No numbers available in {preferredAreaCode}. Here are nearby alternatives:
              </div>
              {nearby.map(numberRow)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="byo" className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Already have a business number you'd like to keep? Enter it below and connect it later.
          </p>
          <Input
            type="tel"
            placeholder="(305) 555-1234"
            value={byoPhone}
            onChange={(e) => setByoPhone(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => linkExisting("byo")}
            disabled={busyAction === "byo" || byoPhone.replace(/\D/g, "").length < 10}
          >
            {busyAction === "byo" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Use this number
          </Button>
        </TabsContent>

        <TabsContent value="forward" className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Keep your existing number and forward unanswered calls to Vektuor.
            We'll show you carrier-specific forwarding steps after this.
          </p>
          <Input
            type="tel"
            placeholder="Existing business number"
            value={byoPhone}
            onChange={(e) => setByoPhone(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => linkExisting("forward")}
            disabled={busyAction === "forward" || byoPhone.replace(/\D/g, "").length < 10}
          >
            {busyAction === "forward" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Set up forwarding
          </Button>
        </TabsContent>

        <TabsContent value="test" className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Use Vektuor's shared test number for 7 days to demo the AI flow before
            connecting a real number.
          </p>
          <Button
            type="button"
            onClick={() => linkExisting("test")}
            disabled={busyAction === "test"}
          >
            {busyAction === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Use a temporary test number
          </Button>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}