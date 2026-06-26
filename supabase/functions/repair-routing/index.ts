import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const VAPI_URL = "https://api.vapi.ai";

function buildSystemPrompt(c: Record<string, any>): string {
  const businessName = c.business_name ?? "the business";
  const industry = c.industry ?? "service business";
  const tone = c.tone ?? "Friendly";
  const questions = (c.intake_questions ?? []) as string[];
  const services = (c.services ?? []) as string[];
  const lines: string[] = [
    `You are a professional AI receptionist for ${c.include_business_name === false ? "a " + industry + " business" : businessName}.`,
    `Industry: ${industry}. Tone: ${tone}. Speak naturally, warmly, and concisely.`,
    "",
    "Answer the call, capture lead information, and let the caller know someone will follow up shortly.",
  ];
  if (services.length) lines.push(`Services offered: ${services.join(", ")}.`);
  if (questions.length) {
    lines.push("", "Ask the caller these questions, one at a time, in a natural conversational way:");
    questions.forEach((q: string, i: number) => lines.push(`${i + 1}. ${q}`));
  }
  lines.push("", "Never invent pricing, availability, or promises. If unsure, say the team will follow up.");
  return lines.join("\n");
}
function buildGreeting(c: Record<string, any>): string {
  if (c.greeting) return c.greeting;
  const name = c.business_name ?? "our office";
  if (c.industry === "med_spa") return `Thank you for calling ${name}, your personal concierge is here. How may I assist you today?`;
  return `Thanks for calling ${name}. How can I help you today?`;
}
async function vapiFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${VAPI_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}
async function upsertAssistant(client: Record<string, any>, apiKey: string, webhookUrl: string, webhookSecret?: string) {
  const payload = {
    name: `Vektuor — ${client.business_name ?? "Tenant"}`.slice(0, 40),
    firstMessage: buildGreeting(client),
    model: { provider: "openai", model: "gpt-4o-mini", messages: [{ role: "system", content: buildSystemPrompt(client) }] },
    voice: client.voice_id ? { provider: "11labs", voiceId: client.voice_id } : { provider: "vapi", voiceId: "Elliot" },
    server: { url: webhookUrl, ...(webhookSecret ? { secret: webhookSecret } : {}) },
    serverMessages: ["status-update", "transcript", "end-of-call-report", "conversation-update", "tool-calls"],
    metadata: { client_id: client.id, user_id: client.user_id },
  };
  if (client.vapi_assistant_id) {
    const upd = await vapiFetch(apiKey, `/assistant/${client.vapi_assistant_id}`, { method: "PATCH", body: JSON.stringify(payload) });
    if (upd.ok && upd.body?.id) return { id: upd.body.id as string, error: null as string | null };
  }
  const created = await vapiFetch(apiKey, `/assistant`, { method: "POST", body: JSON.stringify(payload) });
  if (!created.ok || !created.body?.id) return { id: "", error: `assistant create failed (${created.status}): ${JSON.stringify(created.body)}` };
  return { id: created.body.id as string, error: null };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const clientId = String(body.client_id ?? "").trim();
    if (!clientId) return json({ error: "client_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: client } = await admin.from("callcapture_clients").select("*").eq("id", clientId).maybeSingle();
    if (!client) return json({ error: "Client not found" }, 404);

    let allowed = client.user_id === userId;
    if (!allowed) {
      const { data: me } = await admin.from("callcapture_clients").select("is_super_admin").eq("user_id", userId).maybeSingle();
      allowed = !!me?.is_super_admin;
    }
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY")!;
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vapi-webhook`;
    const webhookSecret = Deno.env.get("VAPI_WEBHOOK_SECRET") ?? "";

    const a = await upsertAssistant(client, VAPI_API_KEY, webhookUrl, webhookSecret || undefined);
    if (a.error || !a.id) return json({ error: a.error ?? "assistant failed" }, 502);
    const assistantId = a.id;

    // Update or register Vapi phone number
    let vapiPhoneNumberId = client.vapi_phone_number_id as string | null;
    let routing_status: "active" | "needs_configuration" = "needs_configuration";
    let routing_error: string | null = null;

    if (vapiPhoneNumberId) {
      const upd = await vapiFetch(VAPI_API_KEY, `/phone-number/${vapiPhoneNumberId}`, { method: "PATCH", body: JSON.stringify({ assistantId }) });
      if (upd.ok) routing_status = "active";
      else routing_error = `Vapi phone-number PATCH failed (${upd.status}): ${JSON.stringify(upd.body)}`;
    } else if (client.assigned_callcapture_number && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const reg = await vapiFetch(VAPI_API_KEY, `/phone-number`, {
        method: "POST",
        body: JSON.stringify({
          provider: "twilio",
          number: client.assigned_callcapture_number,
          twilioAccountSid: TWILIO_ACCOUNT_SID,
          twilioAuthToken: TWILIO_AUTH_TOKEN,
          name: (client.business_name ?? "Vektuor").slice(0, 40),
          assistantId,
        }),
      });
      if (reg.ok && reg.body?.id) { vapiPhoneNumberId = reg.body.id; routing_status = "active"; }
      else routing_error = `Vapi register failed (${reg.status}): ${JSON.stringify(reg.body)}`;
    } else {
      routing_error = "No Vapi phone number id and no Twilio number on file";
    }

    await admin.from("callcapture_clients").update({
      vapi_assistant_id: assistantId,
      vapi_phone_number_id: vapiPhoneNumberId,
      number_status: routing_status,
      webhook_status: routing_status === "active" ? "configured" : "pending",
    }).eq("id", clientId);

    return json({ ok: true, assistant_id: assistantId, vapi_phone_number_id: vapiPhoneNumberId, status: routing_status, routing_error });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});