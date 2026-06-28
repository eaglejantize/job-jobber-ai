import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TestCallButton } from "@/components/TestCallButton";
import { supabase } from "@/integrations/supabase/client";
import { UseControlCenterData } from "../useControlCenterData";

type CallRow = {
  id: string;
  vapi_call_id?: string | null;
  caller_number?: string | null;
  status?: string | null;
  duration_seconds?: number | null;
  started_at?: string | null;
  recording_url?: string | null;
  structured_data?: any;
  raw_payload?: any;
};

export default function TestingTab({ ctx }: { ctx: UseControlCenterData }) {
  const { clientId } = ctx;
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [open, setOpen] = useState<CallRow | null>(null);
  const [turns, setTurns] = useState<any[]>([]);
  const [lead, setLead] = useState<any | null>(null);

  useEffect(() => {
    if (!clientId) return;
    supabase
      .from("callcapture_calls")
      .select("*")
      .eq("client_id", clientId)
      .order("started_at", { ascending: false })
      .limit(25)
      .then(({ data }) => setCalls((data as CallRow[]) || []));
  }, [clientId]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("callcapture_transcript_turns")
      .select("*")
      .eq("call_id", open.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setTurns(data || []));
    setLead(open.structured_data ?? null);
  }, [open]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Test Your AI Receptionist</h2>
          <p className="text-sm text-muted-foreground">Place a test call and review what was captured.</p>
        </div>
        <TestCallButton clientId={clientId ?? undefined} />
      </div>

      <section className="space-y-2">
        <h3 className="font-semibold">Recent Calls</h3>
        <div className="rounded-xl border border-border bg-card divide-y">
          {calls.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No calls yet.</div>}
          {calls.map((c) => (
            <button
              key={c.id}
              onClick={() => setOpen(c)}
              className="w-full text-left px-4 py-3 hover:bg-secondary/40 transition-colors flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.caller_number || "Unknown caller"}</p>
                <p className="text-xs text-muted-foreground">
                  {c.started_at ? new Date(c.started_at).toLocaleString() : "—"}
                  {c.duration_seconds != null && ` · ${c.duration_seconds}s`}
                </p>
              </div>
              <Badge variant={c.status === "booked" ? "default" : "secondary"}>{c.status || "completed"}</Badge>
            </button>
          ))}
        </div>
      </section>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Call detail</SheetTitle>
          </SheetHeader>
          {open && (
            <div className="space-y-6 mt-4">
              <div className="text-sm text-muted-foreground">
                <p>Caller: <strong>{open.caller_number || "—"}</strong></p>
                <p>Status: {open.status || "—"}</p>
                {open.recording_url && (
                  <audio controls src={open.recording_url} className="w-full mt-2" />
                )}
              </div>

              <Block title="Transcript">
                {turns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transcript captured.</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    {turns.map((t: any) => (
                      <p key={t.id}>
                        <span className="font-semibold capitalize">{t.role}: </span>
                        {t.content}
                      </p>
                    ))}
                  </div>
                )}
              </Block>

              <Block title="Extracted Intake">
                <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto">{JSON.stringify(lead, null, 2)}</pre>
              </Block>

              <Block title="Structured Output">
                <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto">{JSON.stringify(open.structured_data, null, 2)}</pre>
              </Block>

              <Block title="Prompt Debug (raw payload)">
                <pre className="text-xs bg-muted/40 rounded p-2 overflow-auto max-h-64">{JSON.stringify(open.raw_payload, null, 2)}</pre>
              </Block>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-sm">{title}</p>
      {children}
    </div>
  );
}