import Layout from "@/components/Layout";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LeadCard, { type Lead } from "@/components/LeadCard";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type BusinessRow = Tables<"callcapture_businesses">;

export default function LeadInbox() {
  const { user, loading } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  // Resolve current user's business_id (single-tenant assumption)
  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from("callcapture_businesses")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Failed to fetch business id:", error);
        toast.error("Could not resolve your business profile.");
        setBusinessId(null);
        setClientId(null);
        return;
      }

      setBusinessId((data as BusinessRow | null)?.id ?? null);

      const { data: clientData } = await supabase
        .from("callcapture_clients")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setClientId((clientData as { id?: string } | null)?.id ?? null);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      let query = supabase
        .from("callcapture_leads")
        .select(
          [
            "id",
            "client_id",
            "business_id",
            "name",
            "phone",
            "address",
            "type",
            "treatment",
            "issue",
            "urgency",
            "summary",
            "new_or_returning",
            "timing",
            "referral",
            "transcript",
            "intake_answers",
            "raw_payload",
            "status",
            "created_at",
            "appointment_id",
            "booking_status",
          ].join(","),
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (businessId && clientId) {
        query = query.or(`business_id.eq.${businessId},client_id.eq.${clientId}`);
      } else if (businessId) {
        query = query.eq("business_id", businessId);
      } else if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;

      if (!active) return;

      if (error) {
        toast.error(error.message);
        setLeads([]);
        return;
      }

      setLeads((data ?? []) as unknown as Lead[]);
    })();

    return () => {
      active = false;
    };
  }, [user, businessId, clientId]);

  useEffect(() => {
    if (!user) return;

    const channelName = businessId ? `leads:business:${businessId}` : `leads:user:${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "callcapture_leads" },
        (payload) => {
          const lead = payload.new as Lead;

          // Client-side safety filter (RLS should still be the primary guard)
          if (businessId && clientId) {
            if (lead.business_id !== businessId && lead.client_id !== clientId) return;
          } else if (businessId && lead.business_id !== businessId) {
            return;
          } else if (clientId && lead.client_id !== clientId) {
            return;
          }

          setLeads((prev) => {
            if (!prev) return [lead];
            if (prev.some((l) => l.id === lead.id)) return prev; // dedupe insert events
            return [lead, ...prev].slice(0, 50);
          });

          toast.success(`New lead: ${lead.name ?? "Unknown caller"}`);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, businessId, clientId]);

  async function markContacted(id: string) {
    const prev = leads;
    setLeads((curr) =>
      curr ? curr.map((l) => (l.id === id ? { ...l, status: "Contacted" } : l)) : curr,
    );

    const { error } = await supabase
      .from("callcapture_leads")
      .update({ status: "Contacted" })
      .eq("id", id);

    if (error) {
      setLeads(prev);
      toast.error(`Failed to update lead: ${error.message}`);
    }
  }

  const hasLeads = useMemo(() => Array.isArray(leads) && leads.length > 0, [leads]);

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
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Call Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Captured calls and customer requests appear here.
          </p>
        </div>

        {leads === null ? (
          <div className="p-8 text-muted-foreground">Loading leads…</div>
        ) : !hasLeads ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold">No leads yet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              When your AI captures a call, it&apos;ll show up here in real time.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onMarkContacted={() => void markContacted(lead.id)}
              />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
