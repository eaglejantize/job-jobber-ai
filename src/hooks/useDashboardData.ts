import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CallStatus = "live" | "new" | "booked" | "transferred" | "completed" | "missed";

export type CallRow = {
  id: string;
  client_id: string | null;
  caller_name: string | null;
  caller_phone: string | null;
  issue_summary: string | null;
  status: CallStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  lead_id: string | null;
};

export type TurnRow = {
  id: string;
  call_id: string;
  role: "ai" | "caller";
  text: string;
  seq: number;
  at: string;
};

export type DispatchRow = {
  id: string;
  call_id: string;
  technician_id: string | null;
  status: "assigned" | "en_route" | "arrived" | "cancelled";
  eta_minutes: number | null;
};

export type TechnicianRow = {
  id: string;
  name: string;
  phone: string | null;
  status: "available" | "assigned" | "en_route" | "off";
};

export type SmsRow = {
  id: string;
  call_id: string | null;
  body: string;
  direction: "outbound" | "inbound";
  to_phone: string | null;
  sent_at: string;
};

export type LeadRow = {
  id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  issue: string | null;
  urgency: string | null;
  summary: string | null;
  intake_answers: Record<string, unknown> | null;
  created_at: string;
};

export function useCalls(clientId: string | null | undefined) {
  const [calls, setCalls] = useState<CallRow[] | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    void supabase
      .from("callcapture_calls")
      .select("id, client_id, caller_name, caller_phone, issue_summary, status, started_at, ended_at, duration_seconds, lead_id")
      .eq("client_id", clientId)
      .order("started_at", { ascending: false })
      .limit(30)
      .then(({ data }) => { if (active) setCalls((data as CallRow[]) ?? []); });

    const channel = supabase
      .channel(`calls:${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "callcapture_calls", filter: `client_id=eq.${clientId}` }, (payload) => {
        setCalls((prev) => {
          const list = prev ?? [];
          if (payload.eventType === "INSERT") return [payload.new as CallRow, ...list].slice(0, 30);
          if (payload.eventType === "UPDATE") return list.map((c) => c.id === (payload.new as CallRow).id ? (payload.new as CallRow) : c);
          if (payload.eventType === "DELETE") return list.filter((c) => c.id !== (payload.old as CallRow).id);
          return list;
        });
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [clientId]);

  return calls;
}

export function useCallDetail(callId: string | null) {
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [dispatch, setDispatch] = useState<DispatchRow | null>(null);
  const [sms, setSms] = useState<SmsRow[]>([]);
  const [lead, setLead] = useState<LeadRow | null>(null);

  useEffect(() => {
    setTurns([]); setDispatch(null); setSms([]); setLead(null);
    if (!callId) return;
    let active = true;

    void supabase.from("callcapture_transcript_turns")
      .select("*").eq("call_id", callId).order("seq").order("at")
      .then(({ data }) => { if (active) setTurns((data as TurnRow[]) ?? []); });
    void supabase.from("callcapture_dispatch")
      .select("*").eq("call_id", callId).maybeSingle()
      .then(({ data }) => { if (active) setDispatch(data as DispatchRow | null); });
    void supabase.from("callcapture_sms_messages")
      .select("*").eq("call_id", callId).order("sent_at", { ascending: false }).limit(10)
      .then(({ data }) => { if (active) setSms((data as SmsRow[]) ?? []); });
    void supabase.from("callcapture_calls").select("lead_id").eq("id", callId).maybeSingle()
      .then(async ({ data }) => {
        const lid = (data as { lead_id?: string } | null)?.lead_id;
        if (!lid) return;
        const { data: ld } = await supabase.from("callcapture_leads")
          .select("id, name, phone, address, issue, urgency, summary, intake_answers, created_at")
          .eq("id", lid).maybeSingle();
        if (active) setLead(ld as LeadRow | null);
      });

    const ch = supabase
      .channel(`call:${callId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "callcapture_transcript_turns", filter: `call_id=eq.${callId}` }, (p) => {
        setTurns((prev) => [...prev, p.new as TurnRow].sort((a, b) => a.seq - b.seq || a.at.localeCompare(b.at)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "callcapture_dispatch", filter: `call_id=eq.${callId}` }, (p) => {
        if (p.eventType === "DELETE") setDispatch(null);
        else setDispatch(p.new as DispatchRow);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "callcapture_sms_messages", filter: `call_id=eq.${callId}` }, (p) => {
        setSms((prev) => [p.new as SmsRow, ...prev].slice(0, 10));
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [callId]);

  return { turns, dispatch, sms, lead };
}

export function useTechnicians(clientId: string | null | undefined) {
  const [techs, setTechs] = useState<TechnicianRow[]>([]);
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    void supabase.from("callcapture_technicians")
      .select("id, name, phone, status").eq("client_id", clientId)
      .then(({ data }) => { if (active) setTechs((data as TechnicianRow[]) ?? []); });
    return () => { active = false; };
  }, [clientId]);
  return techs;
}

export function useDashboardStats(calls: CallRow[] | null) {
  if (!calls) return { today: 0, leads: 0, active: 0 };
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const today = calls.filter((c) => new Date(c.started_at) >= startOfDay).length;
  const leads = calls.filter((c) => new Date(c.started_at) >= startOfDay && (c.status === "booked" || c.status === "new" || c.lead_id)).length;
  const active = calls.filter((c) => c.status === "live").length;
  return { today, leads, active };
}