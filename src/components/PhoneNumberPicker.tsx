import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2,
  Phone,
  CheckCircle2,
  AlertTriangle,
  PhoneForwarded,
  Sparkles,
  Search,
  RefreshCw,
} from "lucide-react";
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

type EnsureClientResult = {
  ok: boolean;
  clientId?: string;
  message?: string;
};

type ErrorPayload = {
  error_code?: string;
  error?: string;
  numbers?: Available[];
  nearby?: Available[];
  fallback_reason?: string | null;
  phone_number?: string;
  sid?: string;
  status?: string;
  message?: string;
};

export default function PhoneNumberPicker({
  clientId,
  preferredAreaCode,
  onAreaCodeChange,
  assignedNumber,
  numberStatus,
  webhookStatus,
  routingError,
  onProvisioned,
  onEnsureClient,
  initializing,
  onRefresh,
  onRetryRepair,
  retryingRepair,
}: {
  clientId: string | null;
  preferredAreaCode: string;
  onAreaCodeChange: (v: string) => void;
  assignedNumber: string | null;
  numberStatus: string | null;
  webhookStatus?: string | null;
  routingError?: string | null;
  onProvisioned: (phone: string, sid: string, status: string) => void;
  onEnsureClient?: () => Promise<EnsureClientResult>;
  initializing?: boolean;
  onRefresh?: () => Promise<void> | void;
  onRetryRepair?: () => Promise<void> | void;
  retryingRepair?: boolean;
}) {
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<null | (() => void)>(null);
  const [numbers, setNumbers] = useState<Available[]>([]);
  const [nearby, setNearby] = useState<Available[]>([]);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [byoPhone, setByoPhone] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [preferredAreaCode]);

  useEffect(() => {
    if (!assignedNumber || !onRefresh) return;
    const pendingStatuses = new Set(["provisioning", "needs_configuration", "pending", "reserved"]);
    if (!pendingStatuses.has(String(numberStatus ?? "")) && webhookStatus !== "pending") return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled || attempts >= 12) return;
      attempts += 1;
      await onRefresh();
      if (!cancelled && attempts < 12) window.setTimeout(tick, 5000);
    };
    const timer = window.setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [assignedNumber, numberStatus, webhookStatus, onRefresh]);

  async function resolveClientId(): Promise<string | null> {
    if (clientId) return clientId;
    if (!onEnsureClient) {
      const msg = "Workspace not ready. Please complete signup before connecting a number.";
      setError(msg);
      return null;
    }
    const result = await onEnsureClient();
    if (result.ok && result.clientId) {
      setInitError(null);
      setError(null);
      return result.clientId;
    }
    setError("We need to finish initializing your workspace before connecting this number. Retry setup initialization.");
    setInitError(result.message ?? "Unknown initialization error");
    return null;
  }

  async function retryInitialization() {
    if (!onEnsureClient) return;
    setRetrying(true);
    try {
      const result = await onEnsureClient();
      if (result.ok && result.clientId) {
        setError(null);
        setInitError(null);
        toast({ title: "Workspace ready", description: "You can continue setup." });
        if (pendingRetry) {
          const fn = pendingRetry;
          setPendingRetry(null);
          fn();
        }
      } else {
        setInitError(result.message ?? "Unknown initialization error");
        setError("We need to finish initializing your workspace before connecting this number. Retry setup initialization.");
      }
    } finally {
      setRetrying(false);
    }
  }

  function reportError(d: ErrorPayload | null | undefined, fallback: string) {
    const map: Record<string, string> = {
      missing_secret: "Vektuor's phone provider isn't configured. Please contact support.",
      twilio_auth_failed: "Twilio authentication failed. Please contact support.",
      no_numbers: "No phone numbers available for that area code.",
      purchase_failed: "Couldn't purchase that number — try another one.",
      bad_request: d?.error ?? "Invalid request.",
      not_found: "Account not found.",
      db_error: "Saved the number but the database update failed. Contact support.",
    };
    const msg = map[d?.error_code ?? ""] ?? d?.error ?? fallback;
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
      const { data, error: invokeError } = await supabase.functions.invoke("search-twilio-numbers", {
        body: { area_code: preferredAreaCode },
      });
      const d: ErrorPayload = (data ?? {}) as ErrorPayload;
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
    } catch (e: unknown) {
      reportError({}, e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function purchase(num: string) {
    const cid = await resolveClientId();
    if (!cid) {
      setPendingRetry(() => () => void purchase(num));
      return;
    }
    setPurchasing(num);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("provision-twilio-number", {
        body: { phone_number: num, client_id: cid },
      });
      const d: ErrorPayload = (data ?? {}) as ErrorPayload;
      if (invokeError || d?.error_code) {
        reportError(d, invokeError?.message ?? "Purchase failed");
        return;
      }
      if (!d.phone_number || !d.sid) {
        reportError({}, "Malformed provisioning response");
        return;
      }
      onProvisioned(d.phone_number, d.sid, d.status ?? "active");
      toast({
        title: d.status === "active" ? "Number active" : "Number reserved",
        description: d.message ?? "Your Vektuor number is set up.",
      });
    } catch (e: unknown) {
      reportError({}, e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  }

  async function linkExisting(mode: "byo" | "forward" | "test") {
    const cid = await resolveClientId();
    if (!cid) {
      setPendingRetry(() => () => void linkExisting(mode));
      return;
    }
    setBusyAction(mode);
    setError(null);
    try {
      const body: Record<string, unknown> = { mode, client_id: cid };
      if (mode !== "test") body.phone_number = byoPhone;
      const { data, error: invokeError } = await supabase.functions.invoke("link-existing-number", { body });
      const d: ErrorPayload = (data ?? {}) as ErrorPayload;
      if (invokeError || d?.error_code) {
        reportError(d, invokeError?.message ?? "Failed to link number");
        return;
      }
      if (!d.phone_number) {
        reportError({}, "Malformed link response");
        return;
      }
      onProvisioned(d.phone_number, "", d.status ?? "pending_forwarding");
      toast({ title: "Number linked", description: d.message ?? "Number linked successfully." });
    } catch (e: unknown) {
      reportError({}, e instanceof Error ? e.message : "Failed to link number");
    } finally {
      setBusyAction(null);
    }
  }

  // Already provisioned view
  if (assignedNumber) {
    const isActive = numberStatus === "active" && webhookStatus === "configured";
    const isPending =
      numberStatus === "provisioning" || numberStatus === "needs_configuration" || webhookStatus === "pending";
    const labelMap: Record<string, string> = {
      active: "Active",
      provisioning: "Configuring",
      needs_configuration: "Needs Configuration",
      pending_forwarding: "Pending Forwarding",
      test: "Test Number",
    };
    const statusText = isActive ? "Configured" : labelMap[numberStatus ?? ""] ?? "Reserved";
    const detail = isActive
      ? "Inbound calls are routed to your AI receptionist."
      : routingError || "Routing is still being configured. If this does not clear shortly, retry routing setup.";
    return (
      <div className="space-y-3">
        <div
          className={
            isActive
              ? "rounded-xl border border-primary/30 bg-primary/5 p-4"
              : "rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
          }
        >
          <div className="flex items-start gap-3">
            {isActive ? (
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            ) : isPending ? (
              <Loader2 className="h-5 w-5 text-amber-600 mt-0.5 animate-spin" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Your Vektuor number</p>
              <p className="text-xl font-semibold mt-1">{formatUS(assignedNumber)}</p>
              <div className="mt-2">
                <Badge variant={isActive ? "default" : "secondary"}>{statusText}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 break-words">{detail}</p>
              {!isActive && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {onRefresh && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onRefresh()}>
                      <RefreshCw className="h-3 w-3" /> Refresh status
                    </Button>
                  )}
                  {onRetryRepair && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRetryRepair()}
                      disabled={retryingRepair}
                    >
                      {retryingRepair ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Retry routing
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const numberRow = (n: Available) => (
    <div key={n.phone_number} className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
      <div>
        <p className="font-medium">{formatUS(n.phone_number)}</p>
        <p className="text-xs text-muted-foreground">
          {[n.locality, n.region].filter(Boolean).join(", ") || n.friendly_name || "US Local"}
        </p>
      </div>
      <Button type="button" size="sm" onClick={() => void purchase(n.phone_number)} disabled={purchasing === n.phone_number}>
        {purchasing === n.phone_number ? <Loader2 className="h-4 w-4 animate-spin" /> : "Choose"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          <TabsTrigger value="new">
            <Sparkles className="h-3 w-3 mr-1" />
            New number
          </TabsTrigger>
          <TabsTrigger value="byo">
            <Phone className="h-3 w-3 mr-1" />I have one
          </TabsTrigger>
          <TabsTrigger value="forward">
            <PhoneForwarded className="h-3 w-3 mr-1" />
            Forward
          </TabsTrigger>
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
                onChange={(e) => onAreaCodeChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>
            <Button
              type="button"
              onClick={() => void searchNumbers()}
              disabled={searching || preferredAreaCode.length !== 3}
              className="bg-cta hover:opacity-90"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search numbers
            </Button>
          </div>

          {numbers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Available in {preferredAreaCode}</p>
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

          {fallbackReason && <p className="text-xs text-muted-foreground">Fallback reason: {fallbackReason}</p>}
        </TabsContent>

        <TabsContent value="byo" className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Already have a business number you'd like to keep? Enter it below and connect it later.
          </p>
          <Input type="tel" placeholder="(305) 555-1234" value={byoPhone} onChange={(e) => setByoPhone(e.target.value)} />
          <Button
            type="button"
            onClick={() => void linkExisting("byo")}
            disabled={busyAction === "byo" || byoPhone.replace(/\D/g, "").length < 10}
          >
            {busyAction === "byo" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Use this number
          </Button>
        </TabsContent>

        <TabsContent value="forward" className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Keep your existing number and forward unanswered calls to Vektuor. We'll show you carrier-specific forwarding
            steps after this.
          </p>
          <Input
            type="tel"
            placeholder="Existing business number"
            value={byoPhone}
            onChange={(e) => setByoPhone(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => void linkExisting("forward")}
            disabled={busyAction === "forward" || byoPhone.replace(/\D/g, "").length < 10}
          >
            {busyAction === "forward" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Set up forwarding
          </Button>
        </TabsContent>

        <TabsContent value="test" className="space-y-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Use Vektuor's shared test number for 7 days to demo the AI flow before connecting a real number.
          </p>
          <Button type="button" onClick={() => void linkExisting("test")} disabled={busyAction === "test"}>
            {busyAction === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Use a temporary test number
          </Button>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <span>{error}</span>
          </div>
          {initError && (
            <>
              <div className="flex items-center gap-2 pl-6">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void retryInitialization()}
                  disabled={retrying || initializing}
                >
                  {retrying || initializing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Retry Setup Initialization
                </Button>
              </div>
              <p className="pl-6 text-xs text-muted-foreground break-words">Details: {initError}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
