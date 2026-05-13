import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  issue: string | null;
  urgency: string | null;
  created_at: string;
  treatment: string | null;
  new_or_returning: string | null;
  timing: string | null;
  referral: string | null;
  summary: string | null;
  business_id: string | null;
};

function isUrgent(value: string | null): boolean {
  if (!value) return false;
  return ["true", "high", "urgent", "yes"].includes(value.trim().toLowerCase());
}

function formatReceived(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function LeadInbox() {
  const { user, loading } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("callcapture_leads")
      .select("id, name, phone, issue, urgency, created_at, treatment, new_or_returning, timing, referral, summary, business_id")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setLeads((data as Lead[]) ?? []));
  }, [user]);

  if (loading) {
    return (
      <Layout>
        <div className="container py-20 text-muted-foreground">Loading…</div>
      </Layout>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Layout>
      <section className="container py-10 md:py-14">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Call Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            Captured calls and customer requests appear here.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card-soft overflow-hidden">
          {leads === null ? (
            <div className="p-8 text-muted-foreground">Loading leads…</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-muted-foreground">
              No leads yet — calls will appear here
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Treatment / Issue</TableHead>
                  <TableHead>Timing</TableHead>
                  <TableHead>Referral</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const treatmentDisplay = lead.treatment ?? lead.issue;
                  const summaryText = lead.summary
                    ? lead.summary.length > 80
                      ? lead.summary.slice(0, 80) + "..."
                      : lead.summary
                    : null;
                  return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {isUrgent(lead.urgency) && (
                          <Badge variant="destructive" className="px-1.5 py-0 text-xs">Urgent</Badge>
                        )}
                        {lead.name || <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      {lead.phone || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-2 text-sm">
                        {treatmentDisplay || <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      {lead.timing || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {lead.referral || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <span className="text-sm text-muted-foreground">
                        {summaryText || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatReceived(lead.created_at)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </Layout>
  );
}