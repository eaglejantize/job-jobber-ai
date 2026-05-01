import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, Phone } from "lucide-react";
import { VAPI_INSTRUCTIONS } from "@/lib/generatePrompt";
import RequestSetupBanner from "@/components/RequestSetupBanner";
import { toast } from "@/hooks/use-toast";

type Config = {
  id: string;
  generated_prompt: string | null;
  assistant_name: string | null;
  updated_at: string;
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("callcapture_assistant_configs")
      .select("id, generated_prompt, assistant_name, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setConfig(data as Config | null); setFetched(true); });
  }, [user]);

  if (loading) return <Layout><div className="container py-20 text-muted-foreground">Loading…</div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;

  const status: "Not Started" | "In Progress" | "Ready" = !fetched
    ? "Not Started"
    : config?.generated_prompt ? "Ready" : config ? "In Progress" : "Not Started";

  const statusColor = status === "Ready"
    ? "bg-primary text-primary-foreground"
    : status === "In Progress"
    ? "bg-secondary text-foreground"
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
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Setup Status</p>
          <div className="mt-3 flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${statusColor}`}>
              {status}
            </span>
            {status !== "Ready" && (
              <Button asChild size="sm" className="bg-cta hover:opacity-90 shadow-glow">
                <Link to="/setup">Continue setup</Link>
              </Button>
            )}
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
              <pre className="max-h-[420px] overflow-auto rounded-xl bg-secondary/40 p-4 text-xs font-mono whitespace-pre-wrap">
{config.generated_prompt}
              </pre>
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

          {/* Demo Instructions */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
            <h2 className="text-lg font-semibold mb-3">Connect to Vapi</h2>
            <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{VAPI_INSTRUCTIONS}</pre>
          </div>
        </div>

        <div className="mt-6">
          <RequestSetupBanner variant="compact" />
        </div>
      </section>
    </Layout>
  );
}