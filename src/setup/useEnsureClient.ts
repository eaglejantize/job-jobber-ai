import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EnsureResult =
  | { ok: true; clientId: string; created: boolean }
  | { ok: false; code: string; message: string };

/**
 * Self-healing workspace initializer used by onboarding surfaces (Concierge/Setup)
 * to make sure a callcapture_clients row exists and is linked to the current user
 * before performing actions like Twilio number provisioning.
 */
export function useEnsureClient() {
  const [initializing, setInitializing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const ensureClient = useCallback(async (): Promise<EnsureResult> => {
    setInitializing(true);
    setLastError(null);
    try {
      const { data: u, error: userErr } = await supabase.auth.getUser();
      if (userErr || !u?.user) {
        const message = userErr?.message ?? "You're signed out. Please sign in again.";
        setLastError(message);
        return { ok: false, code: "not_authenticated", message };
      }
      const user = u.user;
      const uid = user.id;
      const email = (user.email ?? "").toLowerCase();

      // 1. Look up an existing row by user_id, then by email.
      const { data: byUser, error: byUserErr } = await supabase
        .from("callcapture_clients")
        .select("id, user_id, email, setup_step")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byUserErr) {
        const message = `Lookup failed: ${byUserErr.message}`;
        setLastError(message);
        return { ok: false, code: "lookup_failed", message };
      }
      let row = byUser as { id: string; user_id: string | null; email: string | null; setup_step: number | null } | null;

      if (!row && email) {
        const { data: byEmail } = await supabase
          .from("callcapture_clients")
          .select("id, user_id, email, setup_step")
          .ilike("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        row = (byEmail as typeof row) ?? null;
        // If we found a row but it's not linked to this uid, patch it.
        if (row && row.user_id !== uid) {
          const { error: linkErr } = await supabase
            .from("callcapture_clients")
            .update({ user_id: uid } as never)
            .eq("id", row.id);
          if (linkErr) {
            const message = `Couldn't link existing workspace: ${linkErr.message}`;
            setLastError(message);
            return { ok: false, code: "link_failed", message };
          }
        }
      }

      let clientId = row?.id ?? null;
      let created = false;

      // 2. No row → create a minimal one. RLS "auth signup insert" requires
      //    user_id=auth.uid() and non-empty owner_name/business_name/email/alert_phone.
      if (!clientId) {
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const ownerName =
          (meta.owner_name as string) ||
          (meta.full_name as string) ||
          (email ? email.split("@")[0] : "Owner");
        const businessName =
          (meta.business_name as string) ||
          (meta.company as string) ||
          "My Business";
        const alertPhone = (meta.alert_phone as string) || "0000000000";
        const insertPayload = {
          user_id: uid,
          email: email || `${uid}@placeholder.local`,
          owner_name: ownerName,
          business_name: businessName,
          alert_phone: alertPhone,
          setup_status: "Setup In Progress",
          payment_status: "pending",
        };
        const { data: inserted, error: insErr } = await supabase
          .from("callcapture_clients")
          .insert(insertPayload as never)
          .select("id")
          .single();
        if (insErr || !inserted) {
          const message = `Workspace create failed: ${insErr?.message ?? "unknown error"}`;
          setLastError(message);
          return { ok: false, code: "client_insert_failed", message };
        }
        clientId = (inserted as { id: string }).id;
        created = true;
      }

      // 3. Best-effort: ensure onboarding scaffolding fields are present.
      try {
        await supabase
          .from("callcapture_clients")
          .update({ setup_step: row?.setup_step ?? 0 } as never)
          .eq("id", clientId)
          .is("setup_step", null);
      } catch {
        /* non-fatal */
      }

      // 4. Fire-and-forget default Vapi assistant sync. Failure is logged only.
      supabase.functions
        .invoke("update-vapi-agent", { body: { client_id: clientId } })
        .catch((err) => console.warn("update-vapi-agent (non-fatal):", err));

      return { ok: true, clientId, created };
    } catch (e) {
      const message = (e as Error).message || "Unknown initialization error";
      setLastError(message);
      return { ok: false, code: "unexpected", message };
    } finally {
      setInitializing(false);
    }
  }, []);

  return { ensureClient, initializing, lastError };
}