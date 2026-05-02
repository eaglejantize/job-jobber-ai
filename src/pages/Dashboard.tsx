import Layout from "@/components/Layout";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, Phone, Loader2 } from "lucide-react";
import { VAPI_INSTRUCTIONS } from "@/lib/generatePrompt";
import RequestSetupBanner from "@/components/RequestSetupBanner";
import DemoNumberCard from "@/components/DemoNumberCard";
import { toast } from "@/hooks/use-toast";

type Config = {
  id: string;
  generated_prompt: string | null;
  assistant_name: string | null;
  updated_at: string;
};

type Client = {
  id: string;
  setup_status: string;
  payment_status: string;
  subscription_status: string | null;
  alert_phone: string;
  business_name: string;
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [config, setConfig] = useState<Config | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [polling, setPolling] = useState(false);
  const toastedRef = useRef(false);

  // One-time "Payment received" toast on Stripe return.
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
      .select("id, generated_prompt, assistant_name, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setConfig(data as Config | null); setFetched(true); });

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10; // ~30s at 3s
    const startedAt = Date.now();

    const fetchClient = async () => {
      const { data } = await supabase
        .from("callcapture_clients")
        .select("id, setup_status, payment_status, subscription_status, alert_phone, business_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
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
    ?? (!fetched ? "Not Started"
        : config?.generated_prompt ? "Live"
        : config ? "Setup In Progress" : "Not Started");

  const statusColor = status === "Live" || status === "Ready"
    ? "bg-primary text-primary-foreground"
    : status === "Setup In Progress" || status === "In Progress"
    ? "bg-secondary text-foreground"
    : status === "Payment Pending"
    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : "bg-muted text-muted-foreground";

  return (
    <Layout>
      <section className="container py-10 md:py-14">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Your dashboard</h1>
            <p className="text-muted-foreground mt-1">Signed in as {user.email}</p>
          </div>
          <Button
            variant="outline"
            disabled={signingOut}
            onClick={async () => { setSigningOut(true); await supabase.auth.signOut(); }}
          >
            Sign out
          </Button>
        </div>

        {/* Setup status */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft mb-6">
          <div className="grid sm:grid-cols-3 gap-6">
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
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Alert Phone</p>
              <p className="mt-2 font-medium">{client?.alert_phone ?? <span className="text-muted-foreground">—</span>}</p>
            </div>
            <div className="flex items-start sm:justify-end">
              {status !== "Live" && status !== "Ready" ? (
                <Button asChild size="sm" className="bg-cta hover:opacity-90 shadow-glow">
                  <Link to={status === "Payment Pending" ? "/start" : "/setup"}>
                    {status === "Payment Pending" ? "Complete payment" : "Continue setup"}
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link to="/support">Request Setup Help</Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Assistant Instructions */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-card-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Assistant Instructions</h2>
              {config?.generated_prompt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(config.generated_prompt!); toast({ title: "Copied" }); }}
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              )}
            </div>
            {config?.generated_prompt ? (
              <>
              <pre className="max-h-[420px] overflow-auto rounded-xl bg-secondary/40 p-4 text-xs font-mono whitespace-pre-wrap">
{config.generated_prompt}
              </pre>
              <details className="mt-4 rounded-xl border border-border bg-secondary/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold">How to connect this to Vapi</summary>
                <pre className="mt-3 text-xs whitespace-pre-wrap text-muted-foreground">{VAPI_INSTRUCTIONS}</pre>
              </details>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">No script saved yet.</p>
                <Button asChild className="bg-cta hover:opacity-90 shadow-glow">
                  <Link to="/setup">Run the setup wizard</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Demo Number */}
          <div className="space-y-4">
            <DemoNumberCard />
          </div>
        </div>

        <div className="mt-6">
          <RequestSetupBanner variant="compact" />
        </div>
      </section>
    </Layout>
  );
}