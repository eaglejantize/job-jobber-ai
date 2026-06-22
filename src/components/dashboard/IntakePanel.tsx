import { useState } from "react";
import { CallRow, DispatchRow, LeadRow, SmsRow, TechnicianRow } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, MapPin, AlertTriangle, User, Send, Truck, MessageSquare, Loader2 } from "lucide-react";

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const techStatusLabel: Record<DispatchRow["status"], string> = {
  assigned: "Assigned", en_route: "En route", arrived: "Arrived", cancelled: "Cancelled",
};

export default function IntakePanel({
  call, lead, dispatch, sms, technicians, clientId,
}: {
  call: CallRow | null;
  lead: LeadRow | null;
  dispatch: DispatchRow | null;
  sms: SmsRow[];
  technicians: TechnicianRow[];
  clientId: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  if (!call) {
    return (
      <aside className="v-card h-full flex items-center justify-center p-6">
        <p className="text-sm v-muted text-center">Customer intake will appear here</p>
      </aside>
    );
  }

  const tech = technicians.find((t) => t.id === dispatch?.technician_id);
  const captured = !!(lead || call.lead_id || call.caller_name);
  const name = lead?.name || call.caller_name || "Unknown";
  const phone = lead?.phone || call.caller_phone || "—";
  const address = lead?.address || "—";
  const issue = lead?.issue || call.issue_summary || "—";
  const urgency = lead?.urgency || (call.status === "live" ? "Urgent" : "Standard");

  const lastSms = sms[0];

  async function send() {
    if (!draft.trim() || !call) return;
    setSending(true);
    const body = draft.trim();
    setDraft("");
    const { error } = await supabase.from("callcapture_sms_messages").insert({
      client_id: clientId, call_id: call.id, to_phone: phone === "—" ? null : phone,
      body, direction: "outbound", status: "sent",
    });
    setSending(false);
    if (error) toast.error("Failed to send SMS");
    else toast.success("SMS sent");
  }

  return (
    <aside className="v-card h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b v-border flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide">Customer Intake</h2>
        {captured && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-[hsl(152_84%_52%/0.12)] text-[hsl(152_84%_72%)] border border-[hsl(152_84%_52%/0.3)]">
            <CheckCircle2 className="h-3 w-3" /> Synced
          </span>
        )}
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-5">
        <div className="space-y-3">
          <Field icon={<User className="h-3.5 w-3.5" />} label="Name" value={name} />
          <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={address} />
          <Field icon={<MessageSquare className="h-3.5 w-3.5" />} label="Issue" value={issue} />
          <Field
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Urgency"
            value={
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                urgency.toLowerCase().includes("urgent") || urgency.toLowerCase() === "high"
                  ? "bg-[hsl(0_84%_60%/0.15)] text-[hsl(0_90%_78%)]"
                  : "bg-white/5"
              }`}>{urgency}</span>
            }
          />
        </div>

        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider v-muted mb-2 font-semibold">
            <Truck className="h-3 w-3" /> Dispatch
          </div>
          {dispatch ? (
            <div className="rounded-xl border v-border p-3 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{tech?.name || "Unassigned"}</p>
                  <p className="text-xs v-muted">{tech?.phone || "—"}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-[hsl(217_92%_60%/0.15)] text-[hsl(217_92%_82%)]">
                  {techStatusLabel[dispatch.status]}
                </span>
              </div>
              {dispatch.eta_minutes != null && (
                <p className="text-xs v-muted mt-2">ETA <span className="font-semibold text-white">{dispatch.eta_minutes} min</span></p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed v-border p-3 text-xs v-muted">No technician assigned</div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider v-muted mb-2 font-semibold">
            <MessageSquare className="h-3 w-3" /> SMS Follow-up
          </div>
          {lastSms ? (
            <div className="rounded-xl border v-border p-3 bg-white/[0.02] mb-2">
              <p className="text-xs leading-relaxed">{lastSms.body}</p>
              <p className="text-[11px] v-muted mt-2">{lastSms.direction === "outbound" ? "Sent" : "Received"} · {timeAgo(lastSms.sent_at)}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed v-border p-3 text-xs v-muted mb-2">No messages yet</div>
          )}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Send follow-up SMS…"
              className="flex-1 bg-white/[0.04] border v-border rounded-lg px-3 py-2 text-sm placeholder:text-[hsl(215_16%_45%)] focus:outline-none focus:ring-2 focus:ring-[hsl(152_84%_52%/0.4)]"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            />
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="px-3 rounded-lg font-medium text-sm bg-[hsl(152_84%_52%)] text-[hsl(222_47%_6%)] hover:opacity-90 disabled:opacity-40 transition flex items-center gap-1"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 v-muted text-[10px] uppercase tracking-wider font-semibold mb-1">
        {icon} {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}