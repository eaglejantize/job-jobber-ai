import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  owner_name: z.string().trim().min(1).max(120),
  business_name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(160),
  alert_phone: z.string().trim().min(7).max(30),
  password: z.string().min(8).max(72),
  industry: z.string().trim().max(80).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const target = email.toLowerCase();
  // Page through users — listUsers has no server-side email filter on this version.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    console.error("signup_validation_failed", parsed.error.flatten());
    return json({ error: "validation_failed", details: parsed.error.flatten() }, 400);
  }
  const data = parsed.data;
  const emailLower = data.email.toLowerCase();
  console.log("signup_started", { email: emailLower });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1. Auth user — find or create.
  let userId: string;
  try {
    const existing = await findUserByEmail(admin, emailLower);
    if (existing) {
      userId = existing.id;
      console.log("auth_user_found", { user_id: userId, email: emailLower });
      // Reset password so the user can sign in with the password they just typed.
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
      if (updErr) {
        console.error("auth_user_update_failed", { error: updErr.message });
        // Non-fatal — they may already know their password.
      }
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: emailLower,
        password: data.password,
        email_confirm: true,
        user_metadata: { owner_name: data.owner_name, business_name: data.business_name },
      });
      if (createErr || !created.user) {
        console.error("auth_create_failed", { error: createErr?.message });
        return json({ error: "auth_create_failed", message: createErr?.message }, 400);
      }
      userId = created.user.id;
      console.log("auth_user_created", { user_id: userId, email: emailLower });
    }
  } catch (err) {
    console.error("auth_lookup_failed", { error: (err as Error).message });
    return json({ error: "auth_lookup_failed", message: (err as Error).message }, 500);
  }

  // 2. Upsert client row keyed by user_id.
  console.log("client_insert_attempted", { user_id: userId });
  // Look up any existing row for this user or email.
  const { data: existingRows } = await admin
    .from("callcapture_clients")
    .select("id")
    .or(`user_id.eq.${userId},email.ilike.${emailLower}`)
    .order("created_at", { ascending: false })
    .limit(1);
  const existingId = existingRows?.[0]?.id ?? null;

  const payload = {
    user_id: userId,
    owner_name: data.owner_name,
    business_name: data.business_name,
    email: emailLower,
    alert_phone: data.alert_phone,
    industry: data.industry ?? null,
    setup_status: "Payment Pending",
    payment_status: "pending",
  };

  let clientId: string;
  if (existingId) {
    const { error: updErr } = await admin
      .from("callcapture_clients")
      .update(payload)
      .eq("id", existingId);
    if (updErr) {
      console.error("client_insert_failed", { stage: "update", error: updErr.message });
      return json({ error: "client_insert_failed", message: updErr.message }, 500);
    }
    clientId = existingId;
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("callcapture_clients")
      .insert(payload)
      .select("id")
      .single();
    if (insErr || !inserted) {
      console.error("client_insert_failed", { stage: "insert", error: insErr?.message });
      return json({ error: "client_insert_failed", message: insErr?.message }, 500);
    }
    clientId = inserted.id;
  }
  console.log("client_insert_success", { client_id: clientId, user_id: userId });
  console.log("owner_link_created", { client_id: clientId, user_id: userId });

  return json({ client_id: clientId, user_id: userId });
});