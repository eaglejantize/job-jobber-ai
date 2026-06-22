import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CallInbox from "@/components/dashboard/CallInbox";
import ActiveCallPanel from "@/components/dashboard/ActiveCallPanel";
import IntakePanel from "@/components/dashboard/IntakePanel";
import {
  useCalls, useCallDetail, useTechnicians, useDashboardStats,
} from "@/hooks/useDashboardData";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientFetched, setClientFetched] = useState(false);
  const seenLeadsRef = useRef<Set<string>>(new Set());

  useEffect(() => { document.title = "Vektuor · Live Ops"; }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      let { data } = await supabase
        .from("callcapture_clients")
        .select("id, email, user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data && user.email) {
        const { data: byEmail } = await supabase
          .from("callcapture_clients")
          .select("id, email, user_id")
          .ilike("email", user.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        data = byEmail ?? null;
      }
      if (!cancelled) {
        setClientId(data?.id ?? null);
        setClientFetched(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const calls = useCalls(clientId);
  const technicians = useTechnicians(clientId);
  const stats = useDashboardStats(calls);

  // Default selection: live call first, otherwise most recent
  const selectedId = params.get("call");
  useEffect(() => {
    if (!calls || calls.length === 0 || selectedId) return;
    const live = calls.find((c) => c.status === "live");
    const next = live?.id ?? calls[0].id;
    setParams((p) => { const n = new URLSearchParams(p); n.set("call", next); return n; }, { replace: true });
  }, [calls, selectedId, setParams]);

  const selectedCall = useMemo(
    () => calls?.find((c) => c.id === selectedId) ?? null,
    [calls, selectedId],
  );
  const { turns, dispatch, sms, lead } = useCallDetail(selectedId);

  // Toast on new lead captured (call status changing to new/booked or lead linked)
  useEffect(() => {
    if (!calls) return;
    for (const c of calls) {
      const hasLead = !!c.lead_id || c.status === "new" || c.status === "booked";
      if (hasLead && !seenLeadsRef.current.has(c.id)) {
        if (seenLeadsRef.current.size > 0) {
          toast.success("New lead captured", { description: "Synced to CRM" });
        }
        seenLeadsRef.current.add(c.id);
      }
    }
  }, [calls]);

  if (loading) return <div className="vektuor-ops grid place-items-center"><p className="v-muted">Loading…</p></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const systemLive = clientFetched && clientId !== null;

  return (
    <div className="vektuor-ops">
      <DashboardHeader today={stats.today} leads={stats.leads} active={stats.active} systemLive={systemLive} />

      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-6">
        {!clientId && clientFetched ? (
          <div className="v-card p-8 text-center max-w-lg mx-auto mt-12">
            <h2 className="text-lg font-semibold mb-2">Set up your business</h2>
            <p className="v-muted text-sm">Complete onboarding to start receiving live calls in your inbox.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] gap-4 h-[calc(100vh-7rem)]">
            <CallInbox
              calls={calls}
              selectedId={selectedId}
              onSelect={(id) => setParams((p) => { const n = new URLSearchParams(p); n.set("call", id); return n; }, { replace: true })}
            />
            <ActiveCallPanel call={selectedCall} turns={turns} />
            <IntakePanel
              call={selectedCall}
              lead={lead}
              dispatch={dispatch}
              sms={sms}
              technicians={technicians}
              clientId={clientId}
            />
          </div>
        )}
      </div>
    </div>
  );
}