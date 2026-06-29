import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TestCallButton } from "@/components/TestCallButton";

export default function PostApply({ clientId }: { clientId: string | null }) {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

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

  return (
    <div className="text-center py-10 max-w-md mx-auto space-y-6">
      <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
      <div>
        <h2 className="text-xl font-semibold">Your AI receptionist setup has been updated.</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Push the changes to Vapi or place a test call to hear them live.
        </p>
      </div>
      <div className="flex flex-col gap-2">
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