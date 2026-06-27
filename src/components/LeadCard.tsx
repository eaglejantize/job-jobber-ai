import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Phone, CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type Lead = {
  id: string;
  client_id: string | null;
  business_id: string | null;
  name: string | null;
  phone: string | null;
  address: string | null;
  type: string | null;
  treatment: string | null;
  issue: string | null;
  urgency: string | null;
  summary: string | null;
  new_or_returning: string | null;
  timing: string | null;
  referral: string | null;
  transcript: string | null;
  intake_answers: Record<string, unknown> | null;
  raw_payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
  appointment_id?: string | null;
  booking_status?: string | null;
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function statusColor(s: string) {
  switch ((s || "").toLowerCase()) {
    case "new": return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "contacted": return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "closed": return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function LeadCard({ lead, onMarkContacted }: { lead: Lead; onMarkContacted?: () => void }) {
  const [open, setOpen] = useState(false);
  const intake = lead.intake_answers ?? {};
  const [bookedAt, setBookedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!lead.appointment_id) { setBookedAt(null); return; }
    void supabase
      .from("callcapture_appointments")
      .select("start_at")
      .eq("id", lead.appointment_id)
      .maybeSingle()
      .then(({ data }) => { if (active) setBookedAt((data as any)?.start_at ?? null); });
    return () => { active = false; };
  }, [lead.appointment_id]);

  const bookedLabel = bookedAt
    ? new Date(bookedAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card-soft">
      {bookedLabel && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CalendarCheck className="h-3 w-3" /> Booked {bookedLabel}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {lead.name || "Unknown caller"}
            {lead.phone && <span className="text-muted-foreground font-normal"> · {lead.phone}</span>}
          </p>
          {(lead.type || lead.treatment) && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="uppercase tracking-wide">Service:</span> {lead.treatment || lead.type}
            </p>
          )}
          {lead.address && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="uppercase tracking-wide">Address:</span> {lead.address}
            </p>
          )}
          <p className="text-sm text-foreground/90 mt-1 line-clamp-3">{lead.issue ?? lead.summary ?? "—"}</p>
          <p className="mt-1 text-[10px] font-mono text-muted-foreground/70">
            client_id: {lead.client_id ?? "unlinked"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${statusColor(lead.status)}`}>{lead.status || "New"}</span>
          {!lead.client_id && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">Unlinked</span>
          )}
          <span className="text-xs text-muted-foreground">{timeAgo(lead.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {lead.phone && (
          <Button asChild size="sm" variant="outline"><a href={`tel:${lead.phone}`}><Phone className="h-3 w-3" /> Call back</a></Button>
        )}
        {(lead.status || "New").toLowerCase() === "new" && onMarkContacted && (
          <Button size="sm" variant="outline" onClick={onMarkContacted}>Mark as contacted</Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} Details
        </Button>
      </div>
      {open && (
        <div className="mt-4 pt-4 border-t border-border space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Fields</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {([
                ["caller_name", lead.name],
                ["phone", lead.phone],
                ["address", lead.address],
                ["service (treatment)", lead.treatment],
                ["service (type)", lead.type],
                ["issue", lead.issue],
                ["urgency", lead.urgency],
                ["summary", lead.summary],
                ["new_or_returning", lead.new_or_returning],
                ["timing", lead.timing],
                ["referral", lead.referral],
                ["status", lead.status],
                ["client_id", lead.client_id],
                ["business_id", lead.business_id],
                ["created_at", lead.created_at],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="text-muted-foreground">{k}:</dt>
                  <dd className="font-medium break-all">{v == null || v === "" ? "—" : String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Intake answers (JSON)</p>
            <pre className="whitespace-pre-wrap text-xs bg-muted/50 rounded-md p-3 max-h-60 overflow-auto">{JSON.stringify(intake, null, 2)}</pre>
          </div>
          {lead.transcript && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Transcript</p>
              <pre className="whitespace-pre-wrap text-xs bg-muted/50 rounded-md p-3 max-h-60 overflow-auto">{lead.transcript}</pre>
            </div>
          )}
          {lead.raw_payload && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Raw payload (Vapi)</p>
              <pre className="whitespace-pre-wrap text-xs bg-muted/50 rounded-md p-3 max-h-80 overflow-auto">{JSON.stringify(lead.raw_payload, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}