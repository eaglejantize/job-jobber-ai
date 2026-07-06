import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const VAPI_URL = "https://api.vapi.ai";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const APP_VOICE_IDS = new Set([
  "maya",
  "jasmine",
  "claire",
  "marcus",
  "leo",
  "ava",
  "noah",
  "luna",
  "placeholder-maya",
  "placeholder-jasmine",
  "placeholder-claire",
  "placeholder-marcus",
  "placeholder-leo",
  "placeholder-ava",
  "placeholder-noah",
]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizePhone(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function retryFetch(label: string, url: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (attempt < attempts && shouldRetryStatus(response.status)) {
        const text = await response.text().catch(() => "");
        console.warn("[repair-routing] retryable response", { label, attempt, status: response.status, text: text.slice(0, 500) });
        await wait(500 * 2 ** (attempt - 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      console.warn("[repair-routing] retryable network error", { label, attempt, error: error instanceof Error ? error.message : String(error) });
      await wait(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function voicePayload(client: Record<string, unknown>) {
  const saved = String(client.voice_id ?? "").trim();
  if (!saved || APP_VOICE_IDS.has(saved) || saved.startsWith("placeholder-")) {
    return { provider: "vapi", voiceId: "Elliot" };
  }
  return { provider: "11labs", voiceId: saved };
}

function buildSystemPrompt(c: Record<string, unknown>): string {
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
function buildGreeting(c: Record<string, unknown>): string {
  if (c.greeting) return c.greeting;
  const name = c.business_name ?? "our office";
  if (c.industry === "med_spa") return `Thank you for calling ${name}, your personal concierge is here. How may I assist you today?`;
  return `Thanks for calling ${name}. How can I help you today?`;
}
async function vapiFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const r = await retryFetch("vapi", `${VAPI_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await parseBody(r);
  return { ok: r.ok, status: r.status, body };
}

async function findVapiPhoneNumber(apiKey: string, phoneNumber: string) {
  const list = await vapiFetch(apiKey, "/phone-number", { method: "GET" });
  if (!list.ok || !Array.isArray(list.body)) return null;
  const target = normalizePhone(phoneNumber);
  return list.body.find((p: Record<string, unknown>) => {
    const n = normalizePhone(p?.number);
    return n === target || n.endsWith(target) || target.endsWith(n);
  }) ?? null;
}

async function upsertAssistant(client: Record<string, unknown>, apiKey: string, webhookUrl: string, webhookSecret?: string) {
  const payload = {
    name: `Vektuor — ${client.business_name ?? "Tenant"}`.slice(0, 40),
    firstMessage: buildGreeting(client),
    model: { provider: "openai", model: "gpt-4o-mini", messages: [{ role: "system", content: buildSystemPrompt(client) }] },
    voice: voicePayload(client),
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vapi-webhook`;
    const webhookSecret = Deno.env.get("VAPI_WEBHOOK_SECRET") ?? "";
    const now = () => new Date().toISOString();
    const logStep = async (step: string, status: "ok" | "error" | "skipped", detail: Record<string, unknown> = {}) => {
      console[status === "error" ? "error" : "log"]("[repair-routing]", step, status, { client_id: clientId, ...detail });
      await admin.from("callcapture_webhook_events").insert({ client_id: clientId, step, status, detail }).then(() => undefined, () => undefined);
    };

    const a = await upsertAssistant(client, VAPI_API_KEY, webhookUrl, webhookSecret || undefined);
    if (a.error || !a.id) {
      await logStep("assistant_upsert", "error", { error: a.error ?? "assistant failed", voice_id: client.voice_id ?? null });
      await admin.from("callcapture_clients").update({
        number_status: "needs_configuration",
        webhook_status: "failed",
        last_vapi_sync_at: now(),
        last_vapi_sync_status: a.error ?? "assistant failed",
      }).eq("id", clientId);
      return json({ error: a.error ?? "assistant failed" }, 502);
    }
    const assistantId = a.id;
    await logStep("assistant_upsert", "ok", { assistant_id: assistantId, voice: voicePayload(client) });

    // Update or register Vapi phone number
    let vapiPhoneNumberId = client.vapi_phone_number_id as string | null;
    let routing_status: "active" | "needs_configuration" = "needs_configuration";
    let routing_error: string | null = null;

    if (vapiPhoneNumberId) {
      const upd = await vapiFetch(VAPI_API_KEY, `/phone-number/${vapiPhoneNumberId}`, { method: "PATCH", body: JSON.stringify({ assistantId }) });
      if (upd.ok) {
        routing_status = "active";
        await logStep("provider_register", "ok", { vapi_phone_number_id: vapiPhoneNumberId, mode: "patch_existing_id" });
      } else {
        routing_error = `Vapi phone-number PATCH failed (${upd.status}): ${JSON.stringify(upd.body)}`;
        await logStep("provider_register", "error", { error: routing_error });
      }
    } else if (client.assigned_callcapture_number && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const existing = await findVapiPhoneNumber(VAPI_API_KEY, client.assigned_callcapture_number);
      if (existing?.id) {
        const upd = await vapiFetch(VAPI_API_KEY, `/phone-number/${existing.id}`, { method: "PATCH", body: JSON.stringify({ assistantId }) });
        if (upd.ok) {
          vapiPhoneNumberId = existing.id;
          routing_status = "active";
          await logStep("provider_register", "ok", { vapi_phone_number_id: vapiPhoneNumberId, mode: "found_and_patched" });
        } else {
          routing_error = `Vapi phone-number PATCH failed (${upd.status}): ${JSON.stringify(upd.body)}`;
          await logStep("provider_register", "error", { error: routing_error });
        }
      }
      if (!vapiPhoneNumberId) {
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
        if (reg.ok && reg.body?.id) {
          vapiPhoneNumberId = reg.body.id;
          routing_status = "active";
          await logStep("provider_register", "ok", { vapi_phone_number_id: vapiPhoneNumberId, mode: "created" });
        } else {
          routing_error = `Vapi register failed (${reg.status}): ${JSON.stringify(reg.body)}`;
          await logStep("provider_register", "error", { error: routing_error });
        }
      }
    } else {
      routing_error = "No Vapi phone number id and no Twilio number on file";
      await logStep("provider_register", "skipped", { reason: routing_error });
    }

    const voiceUrl = "https://api.vapi.ai/twilio/inbound_call";
    const smsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vapi-webhook?kind=sms`;
    let webhookConfigured = false;
    if (client.twilio_phone_number_sid && LOVABLE_API_KEY && TWILIO_API_KEY) {
      const upd = new URLSearchParams({ VoiceUrl: voiceUrl, VoiceMethod: "POST", SmsUrl: smsUrl, SmsMethod: "POST" });
      const wRes = await retryFetch("twilio webhook update", `${GATEWAY_URL}/IncomingPhoneNumbers/${client.twilio_phone_number_sid}.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: upd,
      });
      const wBody = await parseBody(wRes);
      if (wRes.ok) {
        webhookConfigured = true;
        await logStep("webhook_configured", "ok", { voice_url: voiceUrl, sms_url: smsUrl });
      } else {
        const webhookError = `Twilio webhook update failed (${wRes.status}): ${JSON.stringify(wBody)}`;
        routing_error = routing_error ? `${routing_error}; ${webhookError}` : webhookError;
        routing_status = "needs_configuration";
        await logStep("webhook_configured", "error", { error: webhookError });
      }
    } else {
      webhookConfigured = !client.twilio_phone_number_sid;
      if (!webhookConfigured) await logStep("webhook_configured", "skipped", { reason: "Missing Twilio connector credentials or phone SID" });
    }

    if (routing_status === "active" && !webhookConfigured) {
      routing_status = "needs_configuration";
    }

    await admin.from("callcapture_clients").update({
      vapi_assistant_id: assistantId,
      vapi_phone_number_id: vapiPhoneNumberId,
      number_status: routing_status,
      webhook_status: routing_status === "active" ? "configured" : routing_error ? "failed" : "pending",
      webhook_urls: { voice_url: voiceUrl, sms_url: smsUrl },
      last_vapi_sync_at: now(),
      last_vapi_sync_status: routing_status === "active" ? "Phone number configured and ready." : routing_error,
    }).eq("id", clientId);
    await logStep(routing_status === "active" ? "phone_ready" : "phone_failed", routing_status === "active" ? "ok" : "error", {
      assistant_id: assistantId,
      vapi_phone_number_id: vapiPhoneNumberId,
      routing_error,
    });

    return json({ ok: true, assistant_id: assistantId, vapi_phone_number_id: vapiPhoneNumberId, status: routing_status, routing_error });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});