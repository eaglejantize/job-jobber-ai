import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type State = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON_KEY } },
        );
        const j = await r.json();
        if (r.ok && j?.valid) setState("valid");
        else if (j?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  async function confirm() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      if ((data as any)?.success) setState("success");
      else if ((data as any)?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 shadow-sm">
        <div className="text-sm font-semibold text-foreground mb-2">Vektuor</div>
        <h1 className="text-2xl font-bold tracking-tight mb-4">Email preferences</h1>
        {state === "loading" && <p className="text-muted-foreground">Checking your link…</p>}
        {state === "valid" && (
          <>
            <p className="text-muted-foreground mb-6">
              Click confirm to unsubscribe from Vektuor emails. You can resubscribe any time by contacting support.
            </p>
            <Button onClick={confirm} disabled={busy} className="w-full">
              {busy ? "Working…" : "Confirm unsubscribe"}
            </Button>
          </>
        )}
        {state === "already" && <p className="text-muted-foreground">You're already unsubscribed.</p>}
        {state === "success" && <p className="text-muted-foreground">You've been unsubscribed. We're sorry to see you go.</p>}
        {state === "invalid" && <p className="text-muted-foreground">This unsubscribe link is invalid or has expired.</p>}
        {state === "error" && <p className="text-destructive">Something went wrong. Please try again or contact support.</p>}
      </div>
    </main>
  );
}