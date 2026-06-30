import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft, Loader2, RefreshCw, Rocket, Circle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TestCallButton } from "@/components/TestCallButton";
import { useOnboardingState } from "@/onboarding/useOnboardingState";
import { ITEM_LABELS, ITEM_ORDER, REQUIRED_FOR_ACTIVATION } from "@/onboarding/status";

export default function PostApply({ clientId }: { clientId: string | null }) {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const { state } = useOnboardingState();

  async function sync() {
    if (!clientId) return;
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("update-vapi-agent", {
        body: { client_id: clientId },
      });
      if (error) throw error;
      await supabase
        .from("callcapture_clients")
        .update({
          last_vapi_sync_at: new Date().toISOString(),
          last_vapi_sync_status: "ok",
        } as never)
        .eq("id", clientId);
      toast({ title: "Synced to Vapi" });
    } catch (e) {
      toast({
        title: "Sync failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function goLive() {
    await sync();
    navigate("/dashboard");
  }

  const reqRows = REQUIRED_FOR_ACTIVATION;
  const optionalRows = ITEM_ORDER.filter((id) => !REQUIRED_FOR_ACTIVATION.includes(id));

  return (
    <div className="py-6 space-y-6">
      <div className="text-center space-y-2">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">Your AI receptionist is ready</h2>
        <p className="text-sm text-muted-foreground">
          Final readiness check before going live.
        </p>
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="font-semibold mb-2">Required</div>
        <ul className="space-y-1 text-sm mb-4">
          {reqRows.map((id) => {
            const s = state.items[id]?.status;
            const ok = s === "complete";
            return (
              <li key={id} className="flex items-center gap-2">
                <span>{ok ? "🟢" : "🔴"}</span>
                <span>{ITEM_LABELS[id]}</span>
              </li>
            );
          })}
        </ul>
        <div className="font-semibold mb-2">Optional</div>
        <ul className="space-y-1 text-sm">
          {optionalRows.map((id) => {
            const s = state.items[id]?.status ?? "not_started";
            const icon =
              s === "complete" ? "🟢" : s === "skipped" ? "⏭️" : "⚪";
            return (
              <li key={id} className="flex items-center gap-2">
                <span>{icon}</span>
                <span>{ITEM_LABELS[id]}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <Button
          onClick={goLive}
          disabled={syncing}
          className="w-full bg-cta hover:opacity-90 text-lg py-7"
          type="button"
        >
          {syncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
          GO LIVE
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button onClick={sync} disabled={syncing} className="bg-cta hover:opacity-90" type="button">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync to Vapi
        </Button>
        <TestCallButton />
        <Button variant="outline" onClick={() => navigate("/settings")} type="button">
          <ArrowLeft className="h-4 w-4" /> Return to AI Control Center
        </Button>
      </div>
    </div>
  );
}