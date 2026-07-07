import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UseControlCenterData } from "../useControlCenterData";
import type { Tables } from "@/integrations/supabase/types";

type CallRow = Tables<"callcapture_calls">;
type AppointmentRow = Tables<"callcapture_appointments">;

type Stats = {
  total: number;
  answered: number;
  missed: number;
  apptsRequested: number;
  apptsBooked: number;
  avgLengthSec: number;
};

export default function AnalyticsTab({ ctx }: { ctx: UseControlCenterData }) {
  const { clientId } = ctx;
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const { data: calls } = await supabase
        .from("callcapture_calls")
        .select("status,duration_seconds")
        .eq("client_id", clientId);
      const { data: appts } = await supabase
        .from("callcapture_appointments")
        .select("status")
        .eq("client_id", clientId);
      const rows = (calls ?? []) as CallRow[];
      const total = rows.length;
      const answered = rows.filter((r) => (r.status as string) !== "missed" && (r.status as string) !== "failed").length;
      const missed = total - answered;
      const durations = rows.map((r) => Number(r.duration_seconds) || 0);
      const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      const appointments = (appts ?? []) as AppointmentRow[];
      const apptsRequested = appointments.length;
      const apptsBooked = appointments.filter((a) => a.status === "booked" || a.status === "confirmed").length;
      setStats({ total, answered, missed, apptsRequested, apptsBooked, avgLengthSec: avg });
    })();
  }, [clientId]);

  const cards = [
    { label: "Total Calls", value: stats?.total ?? "—" },
    { label: "Answered Calls", value: stats?.answered ?? "—" },
    { label: "Missed Calls", value: stats?.missed ?? "—" },
    { label: "Appointments Requested", value: stats?.apptsRequested ?? "—" },
    { label: "Appointments Booked", value: stats?.apptsBooked ?? "—" },
    { label: "Avg Call Length", value: stats ? `${stats.avgLengthSec}s` : "—" },
    {
      label: "Conversion Rate",
      value: stats && stats.answered ? `${Math.round((stats.apptsBooked / stats.answered) * 100)}%` : "—",
    },
    { label: "AI Performance", value: "Coming soon" },
    { label: "Customer Satisfaction", value: "Coming soon" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="text-sm text-muted-foreground">Performance of your AI receptionist.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-semibold mt-1">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}