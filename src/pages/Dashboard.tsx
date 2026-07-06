import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CallInbox from "@/components/dashboard/CallInbox";
import ActiveCallPanel from "@/components/dashboard/ActiveCallPanel";
import IntakePanel from "@/components/dashboard/IntakePanel";
import CommandBar from "@/components/CommandBar";
import CommandResultPanel from "@/components/CommandResultPanel";
import { resolveCopilotContext } from "@/copilot/contextResolver";
import { routeCommand } from "@/copilot/commandRouter";
import type { AllowedActionRow, RouteCommandResult } from "@/copilot/types";
import {
  useCalls, useCallDetail, useTechnicians, useDashboardStats,
} from "@/hooks/useDashboardData";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientFetched, setClientFetched] = useState(false);
  const [isCommandRunning, setIsCommandRunning] = useState(false);
  const [commandResult, setCommandResult] = useState<RouteCommandResult | null>(null);
  const seenLeadsRef = useRef<Set<string>>(new Set());
  const fieldCopilotEnabled = String(import.meta.env.VITE_ENABLE_FIELD_COPILOT ?? "").toLowerCase() === "true";

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

  if (loading) return <Layout><div className="vektuor-ops grid place-items-center min-h-[60vh]"><p className="v-muted">Loading…</p></div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;

  const systemLive = clientFetched && clientId !== null;

  async function runCommand(commandText: string) {
    if (!user) return;

    setIsCommandRunning(true);
    try {
      const context = resolveCopilotContext({
        calls,
        currentCallId: selectedId,
      });

      const result = await routeCommand({
        commandText,
        userId: user.id,
        clientId,
        context,
        fetchAllowedActions: async (actionKey, tenantClientId) => {
          let query = supabase
            .from("allowed_actions")
            .select("action_key, role, client_id, is_enabled")
            .eq("action_key", actionKey)
            .eq("role", "authenticated");

          if (tenantClientId) {
            query = query.or(`client_id.eq.${tenantClientId},client_id.is.null`);
          } else {
            query = query.is("client_id", null);
          }

          const { data } = await query;
          return ((data ?? []) as AllowedActionRow[]).filter((row) => row.role === "authenticated");
        },
        writeExecutionAudit: async (record) => {
          const { data, error } = await supabase
            .from("command_execution_log")
            .insert({
              user_id: record.userId,
              client_id: record.clientId,
              command_text: record.commandText,
              intent_key: record.intentKey,
              action_key: record.actionKey,
              status: record.status,
              policy_reason: record.policyReason,
              result_summary: record.resultSummary,
              context_snapshot: record.contextSnapshot,
              error_message: record.errorMessage,
            })
            .select("id")
            .maybeSingle();

          return {
            id: (data as { id?: string } | null)?.id ?? null,
            error: error?.message ?? null,
          };
        },
      });

      if (result.status === "success" && result.navigationTargetCallId) {
        setParams((existing) => {
          const next = new URLSearchParams(existing);
          next.set("call", result.navigationTargetCallId as string);
          return next;
        }, { replace: true });
      }

      setCommandResult(result);
    } finally {
      setIsCommandRunning(false);
    }
  }

  return (
    <Layout>
    <div className="vektuor-ops">
      <DashboardHeader today={stats.today} leads={stats.leads} active={stats.active} systemLive={systemLive} />

      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-6">
        {fieldCopilotEnabled ? (
          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 mb-4">
            <div className="v-card p-4">
              <h2 className="text-sm font-semibold mb-2">Business Assistant</h2>
              <CommandBar isRunning={isCommandRunning} onRunCommand={runCommand} />
            </div>
            <CommandResultPanel isRunning={isCommandRunning} result={commandResult} />
          </div>
        ) : null}

        {!clientId && clientFetched ? (
          <div className="v-card p-8 text-center max-w-lg mx-auto mt-12">
            <h2 className="text-lg font-semibold mb-2">Set up your business</h2>
            <p className="v-muted text-sm">Complete onboarding to start receiving live calls in your inbox.</p>
          </div>
        ) : calls && calls.length === 0 ? (
          <div className="v-card p-10 text-center max-w-xl mx-auto mt-12">
            <div className="h-12 w-12 mx-auto rounded-2xl grid place-items-center mb-4" style={{ background: "linear-gradient(135deg, hsl(152 84% 52% / 0.15), hsl(270 92% 68% / 0.15))" }}>
              <span className="v-live-dot h-2.5 w-2.5" />
            </div>
            <h2 className="text-lg font-semibold mb-1">No active calls.</h2>
            <p className="v-muted text-sm">Your AI receptionist is standing by.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] gap-4 h-[calc(100vh-11rem)]">
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
    </Layout>
  );
}