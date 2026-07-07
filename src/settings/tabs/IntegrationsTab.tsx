import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, CreditCard, FileText, MessageSquare, Phone, Webhook, Zap, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { UseControlCenterData } from "../useControlCenterData";

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "connected" | "not_connected" | "coming_soon";
};

export default function IntegrationsTab({ ctx }: { ctx: UseControlCenterData }) {
  const { data, update, save } = ctx;
  const [calendarId, setCalendarId] = useState<string>(data.google_calendar_id || "primary");
  const [connectingCal, setConnectingCal] = useState(false);
  const calendarConnected = !!data.google_calendar_connected_at || !!data.google_calendar_refresh_token;

  const integrations: Integration[] = [
    { id: "vapi", name: "Vapi", description: "AI voice engine. Managed by Vektuor.", icon: Phone, status: data.vapi_assistant_id ? "connected" : "not_connected" },
    { id: "twilio", name: "Twilio", description: "Phone numbers, SMS, and call routing.", icon: MessageSquare, status: data.assigned_callcapture_number ? "connected" : "not_connected" },
    { id: "google_calendar", name: "Google Calendar", description: "Real-time appointment booking.", icon: Calendar, status: calendarConnected ? "connected" : "not_connected" },
    { id: "ms365", name: "Microsoft 365", description: "Office 365 mail and calendar.", icon: Calendar, status: "coming_soon" },
    { id: "outlook", name: "Outlook Calendar", description: "Outlook calendar booking.", icon: Calendar, status: "coming_soon" },
    { id: "stripe", name: "Stripe", description: "Subscription billing.", icon: CreditCard, status: data.stripe_customer_id ? "connected" : "not_connected" },
    { id: "quickbooks", name: "QuickBooks", description: "Sync invoices and customers.", icon: FileText, status: "coming_soon" },
    { id: "jobber", name: "Jobber", description: "Push leads to Jobber CRM.", icon: FileText, status: "coming_soon" },
    { id: "housecall_pro", name: "Housecall Pro", description: "Push leads to Housecall Pro.", icon: FileText, status: "coming_soon" },
    { id: "servicetitan", name: "ServiceTitan", description: "Push leads to ServiceTitan.", icon: FileText, status: "coming_soon" },
    { id: "zapier", name: "Zapier", description: "Connect to 6,000+ apps.", icon: Zap, status: "coming_soon" },
  ];

  const webhooks: string[] = (data.webhook_urls as unknown as string[]) || [];

  async function connectCalendar() {
    setConnectingCal(true);
    const { error } = await save({
      google_calendar_id: calendarId.trim() || "primary",
      google_calendar_connected_at: new Date().toISOString(),
    });
    setConnectingCal(false);
    if (error) {
      toast({ title: "Calendar connect failed", description: (error as Error).message, variant: "destructive" });
    } else {
      toast({ title: "Google Calendar connected" });
      try { window.dispatchEvent(new CustomEvent("setup:reload")); } catch { /* ignore */ }
    }
  }

  async function disconnectCalendar() {
    const { error } = await save({
      google_calendar_connected_at: null,
      google_calendar_refresh_token: null,
    });
    if (error) toast({ title: "Disconnect failed", description: (error as Error).message, variant: "destructive" });
    else toast({ title: "Google Calendar disconnected" });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {integrations.map((it) => (
            <div key={it.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <it.icon className="h-5 w-5 text-muted-foreground" />
                  <p className="font-semibold">{it.name}</p>
                </div>
                <StatusBadge status={it.status} />
              </div>
              <p className="text-sm text-muted-foreground flex-1">{it.description}</p>
              <Button size="sm" variant="outline" disabled={it.status === "coming_soon"}>
                {it.status === "connected" ? "Manage" : it.status === "coming_soon" ? "Coming soon" : "Connect"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section id="calendar" className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Google Calendar</h2>
          {calendarConnected && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Connected</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Vektuor uses the shared Google Calendar connector. Pick which calendar to book into, then click Connect.
        </p>
        <div className="grid sm:grid-cols-[1fr,auto] gap-2 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="cal-id">Calendar ID</Label>
            <Input id="cal-id" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} placeholder="primary or you@domain.com" />
          </div>
          <div className="flex items-end gap-2">
            {calendarConnected ? (
              <Button variant="outline" onClick={disconnectCalendar}>Disconnect</Button>
            ) : (
              <Button onClick={connectCalendar} disabled={connectingCal} className="bg-cta hover:opacity-90">
                {connectingCal ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting…</> : "Connect"}
              </Button>
            )}
          </div>
        </div>
        {data.google_calendar_connected_at && (
          <div className="text-xs text-muted-foreground">Connected {new Date(data.google_calendar_connected_at).toLocaleString()}</div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Webhook Settings</h2>
        </div>
        <p className="text-sm text-muted-foreground">Forward every new lead and call event to your own systems.</p>
        <div className="space-y-2">
          {webhooks.map((url, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => {
                  const next = [...webhooks]; next[i] = e.target.value; update({ webhook_urls: next });
                }}
                placeholder="https://your-system.com/webhooks/vektuor"
              />
              <Button variant="ghost" onClick={() => update({ webhook_urls: webhooks.filter((_, j) => j !== i) })}>Remove</Button>
            </div>
          ))}
          <Button variant="outline" onClick={() => update({ webhook_urls: [...webhooks, ""] })}>Add webhook URL</Button>
        </div>
        <div className="space-y-2 max-w-md">
          <Label>Webhook Secret</Label>
          <Input
            value={data.webhook_secret || ""}
            onChange={(e) => update({ webhook_secret: e.target.value })}
            placeholder="Used to sign outbound payloads"
          />
        </div>
        <Button
          onClick={async () => {
            const { error } = await save({ webhook_urls: data.webhook_urls, webhook_secret: data.webhook_secret });
            if (error) toast({ title: "Save failed", description: (error as Error).message, variant: "destructive" });
            else toast({ title: "Webhooks saved" });
          }}
          className="bg-cta hover:opacity-90"
        >
          Save Webhooks
        </Button>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: Integration["status"] }) {
  if (status === "connected") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Connected</Badge>;
  if (status === "coming_soon") return <Badge variant="secondary">Coming soon</Badge>;
  return <Badge variant="outline">Not connected</Badge>;
}