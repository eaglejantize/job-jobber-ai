import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const SUPER_ADMIN_EMAIL = "eaglejantize@gmail.com";

const BodySchema = z.object({ client_id: z.string().uuid() });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      console.error("delete-subaccount: getClaims failed", claimsErr);
      return json({ error: "Unauthorized", details: claimsErr?.message }, 401);
    }
    const callerEmail = String(claimsData.claims.email || "").toLowerCase();
    if (callerEmail !== SUPER_ADMIN_EMAIL) {
      console.log("delete-subaccount: forbidden caller", callerEmail);
      return json({ error: "Forbidden: super admin only" }, 403);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
    const { client_id } = parsed.data;

    const admin = createClient(url, serviceKey);

    const { data: client, error: loadErr } = await admin
      .from("callcapture_clients")
      .select("id, user_id, email")
      .eq("id", client_id)
      .maybeSingle();
    if (loadErr) {
      console.error("load client failed", loadErr);
      return json({ error: loadErr.message }, 500);
    }
    if (!client) return json({ error: "Client not found" }, 404);

    const userId: string | null = client.user_id ?? null;
    const email: string = (client.email || "").toLowerCase();
    console.log("delete-subaccount: target", { client_id, userId, email });

    const counts: Record<string, number | null> = {};

    const leads = await admin.from("callcapture_leads").delete({ count: "exact" }).eq("client_id", client_id);
    if (leads.error) console.error("leads delete error", leads.error);
    counts.leads = leads.count ?? 0;

    if (userId) {
      const cfg = await admin.from("callcapture_assistant_configs").delete({ count: "exact" }).eq("user_id", userId);
      if (cfg.error) console.error("configs delete error", cfg.error);
      counts.configs = cfg.count ?? 0;

      const biz = await admin
        .from("callcapture_businesses")
        .delete({ count: "exact" })
        .or(`user_id.eq.${userId}${email ? `,email.ilike.${email}` : ""}`);
      if (biz.error) console.error("businesses delete error", biz.error);
      counts.businesses = biz.count ?? 0;

      const sup = await admin
        .from("callcapture_support_requests")
        .delete({ count: "exact" })
        .or(`user_id.eq.${userId}${email ? `,email.ilike.${email}` : ""}`);
      if (sup.error) console.error("support delete error", sup.error);
      counts.support = sup.count ?? 0;
    } else if (email) {
      const biz = await admin.from("callcapture_businesses").delete({ count: "exact" }).ilike("email", email);
      counts.businesses = biz.count ?? 0;
      const sup = await admin.from("callcapture_support_requests").delete({ count: "exact" }).ilike("email", email);
      counts.support = sup.count ?? 0;
    }

    const cli = await admin.from("callcapture_clients").delete({ count: "exact" }).eq("id", client_id);
    if (cli.error) {
      console.error("client delete error", cli.error);
      return json({ error: cli.error.message }, 500);
    }
    counts.client = cli.count ?? 0;

    let authDeleted = false;
    let authUserId = userId;
    if (!authUserId && email) {
      // Find by email via pagination
      for (let page = 1; page <= 20 && !authUserId; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) { console.error("listUsers error", error); break; }
        const match = data.users.find((u) => (u.email || "").toLowerCase() === email);
        if (match) authUserId = match.id;
        if (!data.users.length || data.users.length < 200) break;
      }
    }
    if (authUserId) {
      const { error: delErr } = await admin.auth.admin.deleteUser(authUserId);
      if (delErr) console.error("auth deleteUser error", delErr);
      else authDeleted = true;
    }

    console.log("delete-subaccount: done", { counts, authDeleted });
    return json({ ok: true, deleted: { ...counts, auth_user: authDeleted } });
  } catch (e) {
    console.error("delete-subaccount fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});