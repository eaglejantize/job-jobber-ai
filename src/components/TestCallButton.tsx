import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Status = "idle" | "calling" | "connected" | "completed" | "failed";

type Result = {
  ok?: boolean;
  callId?: string;
  assistantId?: string;
  voiceId?: string;
  greeting?: string;
  to?: string;
  vapi?: unknown;
  error?: string;
};

type DiagEvent = { id: string; step: string; status: "ok" | "error" | "skipped"; detail: any; created_at: string };

const STEP_LABELS: { step: string; label: string }[] = [
  { step: "test_call_placed", label: "Call placed" },
  { step: "received", label: "Call received" },
  { step: "tenant_matched", label: "Tenant matched" },
  { step: "call_started", label: "Call row created" },
  { step: "transcript_received", label: "Transcript captured" },
  { step: "call_ended", label: "Call ended" },
  { step: "lead_extracted", label: "Lead extracted" },
  { step: "lead_created", label: "Lead saved to inbox" },
  { step: "sms_sent", label: "SMS sent" },
  { step: "servanahq_check", label: "ServanaHQ integration check" },
  { step: "servanahq_synced", label: "ServanaHQ lead synced" },
];

export function TestCallButton({
  clientId,
  disabled,
  disabledReason,
}: {
  clientId?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [events, setEvents] = useState<DiagEvent[]>([]);

  // Poll diagnostics for the active call id
  useEffect(() => {
    if (!result?.callId) return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase
        .from("callcapture_webhook_events")
        .select("id, step, status, detail, created_at")
        .eq("vapi_call_id", result.callId)
        .order("created_at", { ascending: true });
      if (!cancelled && data) setEvents(data as DiagEvent[]);
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [result?.callId]);

  function reset() {
    setStatus("idle");
    setResult(null);
    setShowDetails(false);
    setEvents([]);
  }

  async function placeCall() {
    const trimmed = to.trim();
    if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      toast.error("Enter a phone number in E.164 format, e.g. +15551234567");
      return;
    }
    if (!clientId) {
      toast.error("Save your settings first");
      return;
    }
    setStatus("calling");
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("place-test-call", {
        body: { client_id: clientId, to_number: trimmed },
      });
      const res = (data ?? {}) as Result;
      if (error || !res.ok) {
        setStatus("failed");
        setResult({ ...res, error: error?.message || res.error || "Call failed" });
        toast.error(res.error || error?.message || "Call failed");
        return;
      }
      setResult(res);
      setStatus("connected");
      toast.success("Test call started — your phone should ring shortly");
      // After a short delay, mark as completed (we don't track live status here)
      setTimeout(() => setStatus((s) => (s === "connected" ? "completed" : s)), 60_000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Call failed";
      setStatus("failed");
      setResult({ error: msg });
      toast.error(msg);
    }
  }

  const statusLabel: Record<Status, string> = {
    idle: "",
    calling: "Calling…",
    connected: "Connected — your phone should be ringing",
    completed: "Completed",
    failed: "Failed",
  };

  const statusColor: Record<Status, string> = {
    idle: "",
    calling: "text-amber-600",
    connected: "text-emerald-600",
    completed: "text-muted-foreground",
    failed: "text-destructive",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          <Phone className="h-4 w-4 mr-2" />
          Place Test Call
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Place a Test Call</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your AI receptionist will call this number using your currently saved
            greeting, voice, and industry settings.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="test-call-to">Phone number (E.164)</Label>
            <Input
              id="test-call-to"
              placeholder="+15551234567"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={status === "calling" || status === "connected"}
            />
          </div>
          {status !== "idle" && (
            <div className={`text-sm font-medium ${statusColor[status]}`}>
              {status === "calling" && <Loader2 className="h-4 w-4 animate-spin inline mr-2" />}
              {statusLabel[status]}
            </div>
          )}
          {result?.callId && (
            <div className="rounded-md border border-border bg-background p-3 text-xs space-y-1.5">
              <div className="font-medium text-foreground mb-1">Test Call Result</div>
              {STEP_LABELS.map(({ step, label }) => {
                const ev = events.find((e) => e.step === step);
                const icon = ev?.status === "ok" ? "✅" : ev?.status === "error" ? "❌" : ev?.status === "skipped" ? "⏭️" : "⏳";
                const errorText = ev?.status === "error" ? (ev.detail?.error ?? ev.detail?.reason ?? JSON.stringify(ev.detail)) : null;
                return (
                  <div key={step} className="flex items-start gap-2">
                    <span>{icon}</span>
                    <div className="flex-1">
                      <div>{label}</div>
                      {errorText && <div className="text-destructive text-[11px] mt-0.5">{String(errorText).slice(0, 200)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {result && (status === "connected" || status === "completed" || status === "failed") && (
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs space-y-1">
              <button
                type="button"
                className="font-medium underline"
                onClick={() => setShowDetails((s) => !s)}
              >
                {showDetails ? "Hide" : "Show"} details
              </button>
              {showDetails && (
                <div className="space-y-1 pt-2">
                  <div><span className="text-muted-foreground">Assistant ID:</span> {result.assistantId || "—"}</div>
                  <div><span className="text-muted-foreground">Voice ID:</span> {result.voiceId || "—"}</div>
                  <div><span className="text-muted-foreground">Destination:</span> {result.to || "—"}</div>
                  <div><span className="text-muted-foreground">Greeting:</span> {result.greeting || "—"}</div>
                  {result.callId && <div><span className="text-muted-foreground">Call ID:</span> {result.callId}</div>}
                  {result.error && <div className="text-destructive">Error: {result.error}</div>}
                  {result.vapi !== undefined && (
                    <pre className="mt-2 max-h-48 overflow-auto rounded bg-background p-2 text-[10px]">
{JSON.stringify(result.vapi, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={placeCall} disabled={status === "calling" || status === "connected"}>
            {status === "calling" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Calling…</> : "Call me now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}