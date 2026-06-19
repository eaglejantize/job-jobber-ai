import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LeadCard, { type Lead } from "@/components/LeadCard";
import { Phone } from "lucide-react";
import { toast } from "sonner";

export default function LeadInbox() {
  const { user, loading } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: client } = await supabase
        .from("callcapture_clients")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      const cid = client?.id ?? null;
      setClientId(cid);
      if (!cid) { setLeads([]); return; }
      const { data } = await supabase
        .from("callcapture_leads")
        .select("*")
        .eq("client_id", cid)
        .order("created_at", { ascending: false })
        .limit(200);
      setLeads((data as Lead[]) ?? []);
    })();
  }, [user]);

  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`leads:${clientId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "callcapture_leads", filter: `client_id=eq.${clientId}` }, (payload) => {
        const lead = payload.new as Lead;
        setLeads((prev) => prev ? [lead, ...prev] : [lead]);
        toast.success(`New lead: ${lead.name ?? "Unknown caller"}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId]);

  async function markContacted(id: string) {
    await supabase.from("callcapture_leads").update({ status: "Contacted" }).eq("id", id);
    setLeads((prev) => prev ? prev.map((l) => l.id === id ? { ...l, status: "Contacted" } : l) : prev);
  }

  if (loading) return <Layout><div className="container py-20 text-muted-foreground">Loading…</div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Layout>
      <section className="container py-10 md:py-14">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Call Inbox</h1>
          <p className="text-muted-foreground mt-1">Captured calls and customer requests appear here.</p>
        </div>

        {leads === null ? (
          <div className="p-8 text-muted-foreground">Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold">No leads yet</h2>
            <p className="text-sm text-muted-foreground mt-1">When your AI captures a call, it'll show up here in real time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => <LeadCard key={lead.id} lead={lead} onMarkContacted={() => markContacted(lead.id)} />)}
          </div>
        )}
      </section>
    </Layout>
  );
}