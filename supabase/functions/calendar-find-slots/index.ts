import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  freeBusy,
  generateCandidateSlots,
  filterAvailable,
  resolveAuthForClient,
} from "../_shared/google-calendar.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const clientId: string | undefined = body.client_id;
    const days: number = Math.min(Math.max(Number(body.days ?? 5), 1), 14);
    const max: number = Math.min(Math.max(Number(body.max ?? 6), 1), 20);
    if (!clientId) {
      return new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: client, error } = await supabase
      .from("callcapture_clients")
      .select("id, google_calendar_id, timezone, default_job_duration_minutes, business_hours, google_oauth_access_token, google_oauth_expires_at")
      .eq("id", clientId).maybeSingle();
    if (error || !client) {
      return new Response(JSON.stringify({ error: "client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const calendarId = client.google_calendar_id || "primary";
    const timezone = client.timezone || "America/New_York";
    const duration = client.default_job_duration_minutes || 60;
    const hours = (client.business_hours as any) || { start: "08:00", end: "18:00" };

    const now = new Date();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const auth = await resolveAuthForClient(client as any);
    const busy = await freeBusy(auth, calendarId, now.toISOString(), timeMax.toISOString(), timezone);
    const candidates = generateCandidateSlots({
      fromIso: now.toISOString(),
      days,
      durationMinutes: duration,
      businessHours: hours,
    });
    const free = filterAvailable(candidates, busy).slice(0, max);
    return new Response(JSON.stringify({ ok: true, timezone, duration_minutes: duration, slots: free }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});