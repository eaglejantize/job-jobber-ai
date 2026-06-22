import { CallRow, CallStatus } from "@/hooks/useDashboardData";
import { Phone } from "lucide-react";

const statusStyles: Record<CallStatus, string> = {
  live: "bg-[hsl(0_84%_60%/0.15)] text-[hsl(0_90%_75%)] border border-[hsl(0_84%_60%/0.35)]",
  new: "bg-[hsl(152_84%_52%/0.12)] text-[hsl(152_84%_70%)] border border-[hsl(152_84%_52%/0.30)]",
  booked: "bg-[hsl(217_92%_60%/0.15)] text-[hsl(217_92%_78%)] border border-[hsl(217_92%_60%/0.30)]",
  transferred: "bg-[hsl(270_92%_68%/0.15)] text-[hsl(270_92%_82%)] border border-[hsl(270_92%_68%/0.30)]",
  completed: "bg-white/5 v-muted border v-border",
  missed: "bg-[hsl(35_92%_55%/0.15)] text-[hsl(35_92%_70%)] border border-[hsl(35_92%_55%/0.30)]",
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function CallInbox({
  calls, selectedId, onSelect,
}: { calls: CallRow[] | null; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <aside className="v-card overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b v-border flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide">Inbox</h2>
        <span className="text-xs v-muted">{calls?.length ?? 0} recent</span>
      </div>

      <div className="overflow-y-auto flex-1 divide-y divide-[hsl(var(--v-border))]">
        {calls === null ? (
          <div className="p-6 text-sm v-muted">Loading…</div>
        ) : calls.length === 0 ? (
          <div className="p-8 text-center">
            <Phone className="h-7 w-7 v-muted mx-auto mb-2" />
            <p className="text-sm v-muted">No calls yet</p>
          </div>
        ) : (
          calls.map((c) => {
            const live = c.status === "live";
            const selected = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full text-left px-4 py-3 transition relative ${selected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
              >
                {selected && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[hsl(152_84%_52%)]" />}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {live && <span className="v-live-dot h-2 w-2 shrink-0" />}
                      <p className="text-sm font-medium truncate">{c.caller_name || "Unknown Caller"}</p>
                    </div>
                    <p className="text-xs v-muted truncate mt-0.5">{c.issue_summary || c.caller_phone || "—"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md font-semibold ${statusStyles[c.status]}`}>
                      {c.status}
                    </span>
                    <span className="text-[11px] v-muted tabular-nums">{timeAgo(c.started_at)}</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}