import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";

// Minimal typed wrapper — supabase.auth.oauth is beta and not in types yet.
type OauthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OauthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) { setError("Missing authorization_id"); return; }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) { setError(error.message); return; }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  return (
    <Layout>
      <section className="container py-20">
        <div className="max-w-md mx-auto rounded-2xl border border-border bg-card p-8 shadow-card-soft space-y-4">
          {error ? (
            <>
              <h1 className="text-xl font-bold">Couldn't load this request</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </>
          ) : !details ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <h1 className="text-2xl font-bold">
                Connect {details.client?.name ?? "this app"} to your Vektuor account
              </h1>
              <p className="text-sm text-muted-foreground">
                This lets {details.client?.name ?? "the client"} read your leads, calls, and business profile
                on your behalf. You can revoke access anytime in Vektuor settings.
              </p>
              <div className="flex gap-2 pt-2">
                <Button disabled={busy} onClick={() => decide(true)} className="bg-cta hover:opacity-90 shadow-glow flex-1">
                  Approve
                </Button>
                <Button disabled={busy} variant="outline" onClick={() => decide(false)} className="flex-1">
                  Deny
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}