import Layout from "@/components/Layout";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Phone, Loader2, Settings as SettingsIcon, PhoneCall, ArrowRight, Bot } from "lucide-react";
import RequestSetupBanner from "@/components/RequestSetupBanner";
import { toast } from "@/hooks/use-toast";
import { DEMO_NUMBER } from "@/lib/constants";
import CallDemoButton from "@/components/CallDemoButton";
import { Badge } from "@/components/ui/badge";
import { getVoiceById, DEFAULT_VOICE_ID } from "@/lib/voices";

type Client = {
  id: string;
  setup_status: string;
  payment_status: string;
  subscription_status: string | null;
  alert_phone: string;
  business_name: string;
  assigned_callcapture_number?: string | null;
  number_status?: string | null;
};

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  issue: string | null;
  urgency: string | null;
  created_at: string;
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [client, setClient] = useState<Client | null>(null);
  const [businessPhone, setBusinessPhone] = useState<string | null>(null);
  const [hasConfig, setHasConfig] = useState(false);
  const [configFetched, setConfigFetched] = useState(false);
  const [voiceLabel, setVoiceLabel] = useState<string | null>(null);
  const [voicePersona, setVoicePersona] = useState<string | null>(null);
  const [ringsBeforeAi, setRingsBeforeAi] = useState<number>(3);
  const [aiAnswerMissed, setAiAnswerMissed] = useState<boolean>(true);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [polling, setPolling] = useState(false);
  const toastedRef = useRef(false);

  useEffect(() => {
    if (params.get("checkout") === "success" && !toastedRef.current) {
      toastedRef.current = true;
      toast({ title: "Payment received", description: "We're finalizing your account now." });
      const next = new URLSearchParams(params);
      next.delete("checkout");
      next.delete("session_id");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    if (!user) return;

    void supabase
      .from("callcapture_assistant_configs")
      .select("id, generated_prompt, notification_settings, call_rules")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setHasConfig(!!data?.generated_prompt);
        setConfigFetched(true);
        const notif = (data?.notification_settings ?? {}) as Record<string, unknown>;
        const v = (notif.voice ?? null) as { voice_label?: string; voice_persona?: string } | null;
        if (v?.voice_label) {
          setVoiceLabel(v.voice_label);
          setVoicePersona(v.voice_persona ?? null);
        } else {
          const def = getVoiceById(DEFAULT_VOICE_ID);
          setVoiceLabel(def.label);
          setVoicePersona(def.persona);
        }
        const rules = (data?.call_rules ?? {}) as { ringsBeforeAi?: number; aiAnswerMissed?: boolean };
        setRingsBeforeAi(rules.ringsBeforeAi ?? 3);
        setAiAnswerMissed(rules.aiAnswerMissed !== false);
      });

    void supabase
      .from("callcapture_businesses")
      .select("phone")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setBusinessPhone(data?.phone ?? null); });

    void supabase
      .from("callcapture_leads")
      .select("id, name, phone, issue, urgency, created_at")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setLeads((data as Lead[]) ?? []));

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;
    const startedAt = Date.now();

    const fetchClient = async () => {
      let { data } = await supabase
        .from("callcapture_clients")
        .select("id, setup_status, payment_status, subscription_status, alert_phone, business_name, assigned_callcapture_number, number_status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data && user.email) {
        const { data: byEmail } = await supabase
          .from("callcapture_clients")
          .select("id, setup_status, payment_status, subscription_status, alert_phone, business_name, user_id, assigned_callcapture_number, number_status")
          .ilike("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byEmail) {
          if (!byEmail.user_id) {
            await supabase
              .from("callcapture_clients")
              .update({ user_id: user.id })
              .eq("id", byEmail.id);
          }
          data = byEmail as typeof data;
        }
      }

      if (cancelled) return;
      setClient(data as Client | null);
      const isActive = (data?.payment_status ?? "").toLowerCase() === "active";
      const justArrived = params.get("checkout") === "success" || Date.now() - startedAt < 1000;
      if (!isActive && (justArrived || attempts > 0) && attempts < maxAttempts) {
        setPolling(true);
        attempts += 1;
        setTimeout(fetchClient, 3000);
      } else {
        setPolling(false);
      }
    };
    void fetchClient();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) return <Layout><div className="container py-20 text-muted-foreground">Loading…</div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;

  const paymentActive = (client?.payment_status ?? "").toLowerCase() === "active";
  const status: string = client?.setup_status
    ?? (!configFetched ? "Not Started" : hasConfig ? "Live" : "Not Started");

  const statusColor = status === "Live" || status === "Ready"
    ? "bg-primary text-primary-foreground"
    : status === "Setup In Progress" || status === "In Progress"
    ? "bg-secondary text-foreground"
    : status === "Payment Pending"
    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : "bg-muted text-muted-foreground";

  const assignedNumber = client?.assigned_callcapture_number ?? null;
  const numberStatus = client?.number_status ?? null;
  const phoneToShow = assignedNumber || businessPhone || client?.alert_phone || null;
  const numberStatusLabel =
    numberStatus === "active" ? "Active" :
    numberStatus === "needs_configuration" ? "Needs Configuration" :
    numberStatus ? numberStatus : "—";
  const numberStatusColor =
    numberStatus === "active" ? "bg-primary/15 text-primary" :
    numberStatus === "needs_configuration" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
    "bg-muted text-muted-foreground";

  return (
    <Layout>
      <section className="container py-10 md:py-14">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Your dashboard</h1>
          <p className="text-muted-foreground mt-1">Signed in as {user.email}</p>
        </div>

        {/* Status row */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft mb-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Setup Status</p>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold mt-2 ${statusColor}`}>
                {status}
              </span>
              {polling && !paymentActive && (
                <p className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Finalizing your payment…
                </p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Business Phone</p>
              <p className="mt-2 font-medium">{phoneToShow ?? <span className="text-muted-foreground">—</span>}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">AI Voice</p>
              <p className="mt-2 font-medium">
                {voiceLabel ?? "Maya"}
                {voicePersona && <span className="text-muted-foreground font-normal"> · {voicePersona}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Quick Actions</p>
          <div className="flex flex-wrap gap-3">
            <CallDemoButton className="bg-cta hover:opacity-90 shadow-glow">
              <PhoneCall className="h-4 w-4" /> Test My Agent ({DEMO_NUMBER})
            </CallDemoButton>
            <Button asChild variant="outline">
              <Link to="/settings">
                <SettingsIcon className="h-4 w-4" /> Edit Settings
              </Link>
            </Button>
            {(status !== "Live" && status !== "Ready") && (
              <Button asChild variant="outline">
                <Link to={status === "Payment Pending" ? "/start" : "/setup"}>
                  {status === "Payment Pending" ? "Complete payment" : "Continue setup"}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Call Setup */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Call Setup</h2>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/settings">Edit Phone Setup</Link>
              </Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Vektuor Number</p>
              <p className="mt-2 font-medium">{assignedNumber ?? <span className="text-muted-foreground">—</span>}</p>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mt-2 ${numberStatusColor}`}>
                {numberStatusLabel}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Phone Number</p>
              <p className="mt-2 font-medium">{phoneToShow ?? <span className="text-muted-foreground">—</span>}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Rings before AI</p>
              <p className="mt-2 font-medium">{ringsBeforeAi} {ringsBeforeAi === 1 ? "ring" : "rings"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">AI Backup</p>
              <p className="mt-2 font-medium inline-flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-primary" />
                {aiAnswerMissed ? "ON" : "OFF"}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Inbox</h2>
            {leads && leads.length > 0 && (
              <Link to="/leads" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {leads === null ? (
            <p className="text-sm text-muted-foreground">Loading leads…</p>
          ) : leads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No leads yet — calls will appear here</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {leads.map((l) => (
                <li key={l.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {l.name || "Unknown caller"}
                      {l.phone && <span className="text-muted-foreground font-normal"> · {l.phone}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{l.issue || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.urgency && <Badge variant="secondary">{l.urgency}</Badge>}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(l.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <RequestSetupBanner variant="compact" />
      </section>
    </Layout>
  );
}