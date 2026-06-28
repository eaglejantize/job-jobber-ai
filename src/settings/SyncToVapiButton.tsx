import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function SyncToVapiButton({
  clientId,
  lastSyncAt,
  lastStatus,
  onSynced,
}: {
  clientId: string | null;
  lastSyncAt?: string | null;
  lastStatus?: string | null;
  onSynced?: () => void;
}) {
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    if (!clientId) {
      toast({ title: "No client record yet", variant: "destructive" });
      return;
    }
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
      toast({ title: "Synced to Vapi", description: "Your AI receptionist is up to date." });
      onSynced?.();
    } catch (e) {
      await supabase
        .from("callcapture_clients")
        .update({
          last_vapi_sync_at: new Date().toISOString(),
          last_vapi_sync_status: `error: ${(e as Error).message}`,
        } as never)
        .eq("id", clientId);
      toast({
        title: "Sync failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  const when = lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never";
  return (
    <div className="flex items-center gap-3">
      <div className="text-right text-xs text-muted-foreground hidden sm:block">
        <div>Last sync: {when}</div>
        {lastStatus && lastStatus !== "ok" && (
          <div className="text-destructive truncate max-w-[260px]">{lastStatus}</div>
        )}
      </div>
      <Button onClick={sync} disabled={syncing} className="bg-cta hover:opacity-90">
        {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Sync to Vapi
      </Button>
    </div>
  );
}