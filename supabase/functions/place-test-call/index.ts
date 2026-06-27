import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const BodySchema = z.object({
  client_id: z.string().uuid(),
  to_number: z.string().regex(/^\+[1-9]\d{6,14}$/, "to_number must be E.164, e.g. +15551234567"),
});

function normalize(p: string | null | undefined): string {
  return (p ?? "").replace(/\D/g, "");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { ok: false, error: "Unauthorized" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json(401, { ok: false, error: "Unauthorized" });
    const userId = claimsData.claims.sub as string;

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(400, { ok: false, error: "Invalid request", fields: parsed.error.flatten().fieldErrors });
    }
    const { client_id, to_number } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: client, error: cErr } = await admin
      .from("callcapture_clients")
      .select("*")
      .eq("id", client_id)
      .maybeSingle();
    if (cErr || !client) return json(404, { ok: false, error: cErr?.message ?? "Client not found" });

    // Authorization: owner or super admin
    let allowed = client.user_id === userId;
    if (!allowed) {
      const { data: me } = await admin
        .from("callcapture_clients")
        .select("is_super_admin")
        .eq("user_id", userId)
        .maybeSingle();
      allowed = !!me?.is_super_admin;
    }
    if (!allowed) return json(403, { ok: false, error: "Forbidden" });

    // Prefer ids stored on the tenant row.
    let phoneNumberId = (client.vapi_phone_number_id as string | null) ?? null;
    let assistantId = (client.vapi_assistant_id as string | null) ?? null;

    // Fallback: look up by number on Vapi (legacy tenants without stored ids).
    if (!phoneNumberId || !assistantId) {
      const targetNumber = normalize(client.assigned_callcapture_number) || normalize(client.business_phone);
      if (!targetNumber) return json(400, { ok: false, error: "No phone number assigned to this client" });
      const phoneRes = await fetch("https://api.vapi.ai/phone-number", { headers: { Authorization: `Bearer ${VAPI_API_KEY}` } });
      if (!phoneRes.ok) {
        const text = await phoneRes.text();
        return json(502, { ok: false, error: `Vapi phone-number lookup failed: ${phoneRes.status} ${text}` });
      }
      const phones = (await phoneRes.json()) as Array<{ id?: string; number?: string; assistantId?: string }>;
      const match = phones.find(
        (p) =>
          normalize(p.number) === targetNumber ||
          normalize(p.number).endsWith(targetNumber) ||
          targetNumber.endsWith(normalize(p.number)),
      );
      phoneNumberId = phoneNumberId ?? match?.id ?? null;
      assistantId = assistantId ?? match?.assistantId ?? null;
    }

    if (!phoneNumberId || !assistantId) {
      return json(404, {
        ok: false,
        error: `No Vapi assistant linked to this tenant. Run "Repair routing" from the admin panel.`,
      });
    }

    const greeting = (client.greeting as string | null) ?? "";
    const voiceId = (client.voice_id as string | null) ?? null;

    console.log("place-test-call", {
      client_id,
      assistantId,
      voiceId,
      greeting,
      to_number,
      business_name: client.business_name,
      industry: client.industry,
    });

    const callRes = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumberId,
        assistantId,
        customer: { number: to_number },
        metadata: { client_id, user_id: userId, test_call: true },
      }),
    });
    const vapi = await callRes.json().catch(() => ({}));
    console.log("vapi /call response", { status: callRes.status, vapi });

    if (!callRes.ok) {
      return json(502, {
        ok: false,
        error: `Vapi call failed: ${callRes.status}`,
        assistantId,
        voiceId,
        greeting,
        to: to_number,
        vapi,
      });
    }

    const vapiCallId = (vapi as { id?: string })?.id ?? null;

    // Pre-create call row so the inbox/dashboard shows it instantly.
    if (vapiCallId) {
      await admin.from("callcapture_calls").insert({
        vapi_call_id: vapiCallId,
        client_id,
        caller_phone: to_number,
        status: "queued",
        is_test: true,
        metadata: { test_call: true, initiated_by: userId },
      });
      await admin.from("callcapture_webhook_events").insert({
        client_id, vapi_call_id: vapiCallId, step: "test_call_placed", status: "ok",
        detail: { to: to_number, assistantId, phoneNumberId },
      });
    }

    return json(200, {
      ok: true,
      callId: vapiCallId,
      assistantId,
      voiceId,
      greeting,
      to: to_number,
      vapi,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("place-test-call error:", message);
    return json(500, { ok: false, error: message });
  }
});