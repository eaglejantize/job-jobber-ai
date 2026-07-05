import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function currentClientId(ctx: ToolContext): Promise<string | null> {
  const sb = supabaseForUser(ctx);
  const userId = ctx.getUserId();
  const email = ctx.getUserEmail();
  const { data } = await sb
    .from("callcapture_clients")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id;
  if (email) {
    const { data: byEmail } = await sb
      .from("callcapture_clients")
      .select("id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return byEmail?.id ?? null;
  }
  return null;
}