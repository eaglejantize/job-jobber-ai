import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type ClientRow = {
  id: string;
  servanahq_enabled: boolean;
  servanahq_tenant_id: string | null;
};

type LastSync = {
  servanahq_sync_status: string | null;
  servanahq_synced_at: string | null;
  servanahq_sync_error: string | null;
};

export default function ServanaHqSettings({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [c, setC] = useState<ClientRow | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [last, setLast] = useState<LastSync | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: client }, statusRes, { data: lastLead }] = await Promise.all([
        supabase.from("callcapture_clients")
          .select("id, servanahq_enabled, servanahq_tenant_id")
          .eq("id", clientId).maybeSingle(),
        supabase.functions.invoke("servanahq-status"),
        supabase.from("callcapture_leads")
          .select("servanahq_sync_status, servanahq_synced_at, servanahq_sync_error")
          .eq("client_id", clientId)
          .not("servanahq_sync_status", "is", null)
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle(),
      ]);
      if (client) setC(client as ClientRow);
      setConfigured(!!(statusRes.data as { configured?: boolean } | null)?.configured);
      setLast((lastLead as LastSync | null) ?? null);
      setLoading(false);
    })();
  }, [clientId]);

  async function save() {
    if (!c) return;
    setSaving(true);
    const { error } = await supabase.from("callcapture_clients").update({
      servanahq_enabled: c.servanahq_enabled,
      servanahq_tenant_id: c.servanahq_tenant_id?.trim() || null,
    }).eq("id", c.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("ServanaHQ settings saved");
  }

  if (loading || !c) {
    return <div className="py-6 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</div>;
  }

  const statusBadge = () => {
    if (configured === false) {
      return (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" />
          ServanaHQ integration pending endpoint — global secrets not configured yet.
        </div>
      );
    }
    if (last?.servanahq_sync_status === "synced") {
      return (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Connected — last sync {last.servanahq_synced_at ? new Date(last.servanahq_synced_at).toLocaleString() : "—"}
        </div>
      );
    }
    if (last?.servanahq_sync_status === "failed") {
      return (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4" />
          Last sync failed: {last.servanahq_sync_error ?? "unknown error"}
        </div>
      );
    }
    return (
      <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
        Ready — no leads synced yet.
      </div>
    );
  };

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">ServanaHQ Lead Inbox sync</h3>
          <p className="text-xs text-muted-foreground">
            Push every captured Vektuor lead into your ServanaHQ Lead Inbox.
          </p>
        </div>
        <Switch
          checked={c.servanahq_enabled}
          onCheckedChange={(v) => setC({ ...c, servanahq_enabled: v })}
        />
      </div>

      {statusBadge()}

      <div className="space-y-1.5">
        <Label htmlFor="servanahq-tenant">ServanaHQ Tenant ID</Label>
        <Input
          id="servanahq-tenant"
          value={c.servanahq_tenant_id ?? ""}
          onChange={(e) => setC({ ...c, servanahq_tenant_id: e.target.value })}
          placeholder="e.g. tenant_8f3a2…"
          disabled={!c.servanahq_enabled}
        />
        <p className="text-[11px] text-muted-foreground">
          Found in your ServanaHQ admin under Settings → API.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
        </Button>
      </div>
    </section>
  );
}