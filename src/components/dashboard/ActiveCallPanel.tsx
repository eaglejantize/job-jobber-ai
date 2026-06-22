import { useEffect, useRef, useState } from "react";
import { CallRow, TurnRow } from "@/hooks/useDashboardData";
import CallWaveform from "./CallWaveform";
import { Phone, PhoneOff } from "lucide-react";

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function ActiveCallPanel({ call, turns }: { call: CallRow | null; turns: TurnRow[] }) {
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (call?.status !== "live") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [call?.status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  if (!call) {
    return (
      <section className="v-card h-full flex items-center justify-center">
        <div className="text-center px-6">
          <div className="h-14 w-14 mx-auto rounded-2xl grid place-items-center mb-4" style={{ background: "linear-gradient(135deg, hsl(152 84% 52% / 0.15), hsl(270 92% 68% / 0.15))" }}>
            <Phone className="h-6 w-6 text-[hsl(152_84%_70%)]" />
          </div>
          <p className="text-sm v-muted">Select a call to view details</p>
        </div>
      </section>
    );
  }

  const live = call.status === "live";
  const duration = live
    ? Math.floor((now - new Date(call.started_at).getTime()) / 1000)
    : (call.duration_seconds ?? 0);

  return (
    <section className="v-card h-full flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b v-border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {live && <span className="v-live-dot h-2 w-2" />}
              <h2 className="text-lg font-semibold truncate">{call.caller_name || "Unknown Caller"}</h2>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-semibold ${live ? "bg-[hsl(0_84%_60%/0.18)] text-[hsl(0_90%_78%)]" : "bg-white/5 v-muted"}`}>
                {call.status}
              </span>
            </div>
            <p className="text-xs v-muted mt-1">{call.caller_phone || "No number"} · {call.issue_summary || "—"}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold tabular-nums">{fmtDuration(duration)}</div>
            <div className="text-[10px] uppercase tracking-wider v-muted">{live ? "On call" : "Duration"}</div>
          </div>
        </div>
        <div className="mt-3">
          <CallWaveform active={live} />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {turns.length === 0 ? (
          <div className="text-center py-12">
            <PhoneOff className="h-6 w-6 v-muted mx-auto mb-2" />
            <p className="text-xs v-muted">No transcript captured for this call</p>
          </div>
        ) : (
          turns.map((t) => (
            <div key={t.id} className={`flex ${t.role === "ai" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                  t.role === "ai"
                    ? "bg-white/[0.04] border v-border rounded-tl-sm"
                    : "bg-[hsl(152_84%_52%/0.12)] border border-[hsl(152_84%_52%/0.25)] text-[hsl(152_84%_88%)] rounded-tr-sm"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{t.role === "ai" ? "AI" : "Caller"}</div>
                <div>{t.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}