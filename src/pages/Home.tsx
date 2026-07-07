import Layout from "@/components/Layout";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Phone, Loader2, Settings as SettingsIcon, ArrowRight, Inbox } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import CallDemoButton from "@/components/CallDemoButton";
import { Badge } from "@/components/ui/badge";
import { getVoiceById, getVoiceByLabel } from "@/lib/voices";

type Client = {
  id: string;
  setup_status: string;
  payment_status: string;
  subscription_status: string | null;
  is_super_admin?: boolean | null;
  alert_phone: string;
  business_name: string;
  assigned_callcapture_number?: string | null;
  number_status?: string | null;
  business_phone?: string | null;
  voice_id?: string | null;
  voice_label?: string | null;
  voice_sync_status?: "synced" | "failed" | "pending" | null;
  voice_last_sync_error?: string | null;
  ai_personality?: string | null;
  rings_before_answer?: number | null;
  activated_at?: string | null;
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

function normalizeState(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function setupIsIncomplete(status: string): boolean {
  const normalized = normalizeState(status);
  return normalized !== "live" && normalized !== "ready" && normalized !== "active";
}

function requiresPayment(status: string, subscriptionStatus: string | null | undefined): boolean {
  const payment = normalizeState(status);
  const subscription = normalizeState(subscriptionStatus);
  return [
    "pending",
    "unpaid",
    "expired",
    "past_due",
    "canceled",
    "cancelled",
    "incomplete",
    "incomplete_expired",
    "suspended",
  ].includes(payment)
    || [
      "unpaid",
      "expired",
      "past_due",
      "canceled",
      "cancelled",
      "incomplete",
      "incomplete_expired",
    ].includes(subscription);
}

export default function Home() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [client, setClient] = useState<Client | null>(null);
  const [businessExists, setBusinessExists] = useState<boolean | null>(null);
  const [hasConfig, setHasConfig] = useState(false);
  const [configFetched, setConfigFetched] = useState(false);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [polling, setPolling] = useState(false);
  const toastedRef = useRef(false);
  const navigate = useNavigate();

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
      .select("id, generated_prompt")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setHasConfig(!!data?.generated_prompt);
        setConfigFetched(true);
      });

    void supabase
      .from("callcapture_businesses")
      .select("id, phone, subscription_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setBusinessExists(!!data?.id);
      });

    // If we just returned from checkout but the webhook hasn't created the
    // business row yet, poll briefly so the page reflects it without a refresh.
    if (params.get("checkout") === "success") {
      let tries = 0;
      const poll = async () => {
        if (tries++ >= 15) return;
        const { data } = await supabase
          .from("callcapture_businesses")
          .select("id, phone, subscription_status")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (data?.id) {
          setBusinessExists(true);
        } else {
          setTimeout(poll, 2000);
        }
      };
      void poll();
    }

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
        .select("id, setup_status, payment_status, subscription_status, is_super_admin, alert_phone, business_name, assigned_callcapture_number, number_status, business_phone, voice_id, voice_label, voice_sync_status, voice_last_sync_error, ai_personality, rings_before_answer")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data && user.email) {
        const { data: byEmail } = await supabase
          .from("callcapture_clients")
          .select("id, setup_status, payment_status, subscription_status, is_super_admin, alert_phone, business_name, user_id, assigned_callcapture_number, number_status, business_phone, voice_id, voice_label, voice_sync_status, voice_last_sync_error, ai_personality, rings_before_answer")
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
      // First-time users see the Home page with a "finish setup" prompt —
      // never auto-redirect away from Home.
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

  // Realtime: new leads → toast + bump recent list
  useEffect(() => {
    if (!client?.id) return;
    const channel = supabase
      .channel(`dash-leads:${client.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "callcapture_leads", filter: `client_id=eq.${client.id}` }, (payload) => {
        const lead = payload.new as Lead;
        setLeads((prev) => prev ? [lead, ...prev].slice(0, 5) : [lead]);
        toast({ title: "New lead", description: lead.name || lead.phone || "A new call was captured." });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client?.id]);

  if (loading) return <Layout><div className="container py-20 text-muted-foreground">Loading…</div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;

  const status: string = client?.setup_status
    ?? (!configFetched ? "Not Started" : hasConfig ? "Live" : "Not Started");
  const isSuperAdmin = Boolean(client?.is_super_admin);
  const setupIncomplete = setupIsIncomplete(status);
  const paymentNeeded =
    requiresPayment(client?.payment_status ?? "", client?.subscription_status)
    || (businessExists === false && client === null);
  const completeSignupTarget = setupIncomplete && !paymentNeeded ? "/settings" : "/start";

  // Tenant has signed up + paid but the webhook hasn't created their business
  // row yet (or they haven't paid). Show a "finalizing" screen instead of an
  // empty dashboard. Only triggers when there's also no legacy client row.
  if (businessExists === false && client === null && !isSuperAdmin) {
    const justPaid = params.get("checkout") === "success";
    return (
      <Layout>
        <section className="container py-20 max-w-2xl">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-card-soft text-center">
            <Loader2 className="h-8 w-8 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold">
              {justPaid ? "Finalizing your account…" : "Almost there"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {justPaid
                ? "We're activating your subscription. This page will refresh automatically."
                : "Your account doesn't have an active subscription yet. Complete checkout to get started."}
            </p>
            {!justPaid && (
              <div className="mt-6">
                <Button className="bg-cta hover:opacity-90 shadow-glow" onClick={() => navigate(completeSignupTarget)}>
                  Complete signup
                </Button>
              </div>
            )}
          </div>
        </section>
      </Layout>
    );
  }

  const paymentActive = (client?.payment_status ?? "").toLowerCase() === "active";

  const statusColor = status === "Live" || status === "Ready"
    ? "bg-primary text-primary-foreground"
    : status === "Setup In Progress" || status === "In Progress"
    ? "bg-secondary text-foreground"
    : status === "Payment Pending"
    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : "bg-muted text-muted-foreground";

  const assignedNumber = client?.assigned_callcapture_number ?? null;
  const numberStatus = client?.number_status ?? null;
  const businessNumber = client?.business_phone ?? null;
  const numberStatusLabel =
    numberStatus === "active" ? "Active" :
    numberStatus === "needs_configuration" ? "Needs Configuration" :
    numberStatus ? numberStatus : "—";
  const numberStatusColor =
    numberStatus === "active" ? "bg-primary/15 text-primary" :
    numberStatus === "needs_configuration" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
    "bg-muted text-muted-foreground";

  const voice =
    getVoiceByLabel(client?.voice_label ?? undefined) ??
    (client?.voice_id ? getVoiceById(client.voice_id) : undefined);
  const voiceNeedsAttention = client?.voice_sync_status === "failed" || !!client?.voice_last_sync_error;
  const voiceDisplayLabel = client?.ai_personality?.trim() || voice?.label || null;
  const voicePersonaLabel = voice?.persona ?? null;

  const rings = client?.rings_before_answer;
  const ringsLabel =
    rings === null || rings === undefined
      ? null
      : rings === 0
      ? "Answer immediately"
      : `${rings} ${rings === 1 ? "ring" : "rings"}`;

  const setupComplete = status === "Live" || status === "Ready";
  const setupPath = "/settings/concierge";

  return (
    <Layout>
      <section className="container py-10 md:py-14">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Home</h1>
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
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Business Number</p>
              {businessNumber ? (
                <p className="mt-2 font-medium">{businessNumber}</p>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Not configured</p>
                  <Link to={setupPath} className="text-xs text-primary hover:underline">
                    Configure Business Number
                  </Link>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">AI Voice</p>
              {voiceDisplayLabel ? (
                <>
                  <p className="mt-2 font-medium">
                    {voiceDisplayLabel}
                    {voicePersonaLabel && (
                      <span className="text-muted-foreground font-normal"> · {voicePersonaLabel}</span>
                    )}
                  </p>
                  {voiceNeedsAttention && (
                    <p className="mt-1 text-xs text-destructive">Voice setup needs attention</p>
                  )}
                </>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Not configured</p>
                  <Link to={setupPath} className="text-xs text-primary hover:underline">
                    Choose a voice
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Quick Actions</p>
          <div className="flex flex-wrap gap-3">
            <CallDemoButton className="bg-cta hover:opacity-90 shadow-glow">
              Test My AI{"\u00a0"}
            </CallDemoButton>
            <Button asChild variant="outline">
              <Link to={status === "Payment Pending" ? "/start" : setupPath}>
                <SettingsIcon className="h-4 w-4" />
                {status === "Payment Pending"
                  ? "Complete payment"
                  : setupComplete
                  ? "Edit Setup"
                  : "Continue Setup"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/leads">
                <Inbox className="h-4 w-4" /> View Inbox
              </Link>
            </Button>
          </div>
        </div>

        {/* Call Setup */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Call Setup</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Vektuor Number</p>
              {assignedNumber ? (
                <>
                  <p className="mt-2 font-medium">{assignedNumber}</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mt-2 ${numberStatusColor}`}>
                    {numberStatusLabel}
                  </span>
                </>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Not configured</p>
                  <Link to={setupPath} className="text-xs text-primary hover:underline">
                    Claim a number
                  </Link>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Business Number</p>
              {businessNumber ? (
                <p className="mt-2 font-medium">{businessNumber}</p>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Not configured</p>
                  <Link to={setupPath} className="text-xs text-primary hover:underline">
                    Configure Business Number
                  </Link>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Rings before AI</p>
              {ringsLabel ? (
                <p className="mt-2 font-medium">{ringsLabel}</p>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">Not configured</p>
                  <Link to={setupPath} className="text-xs text-primary hover:underline">
                    Set rings
                  </Link>
                </div>
              )}
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
      </section>
    </Layout>
  );
}