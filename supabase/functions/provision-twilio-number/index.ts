import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const VAPI_URL = "https://api.vapi.ai";
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
        const body = await response.text().catch(() => "");
        console.warn(`[phone-provision] retryable ${label} response`, {
          attempt,
          status: response.status,
          body: body.slice(0, 500),
        });
        await wait(500 * 2 ** (attempt - 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      console.warn(`[phone-provision] retryable ${label} network error`, {
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      await wait(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function voicePayload(client: Record<string, any>) {
  const saved = String(client.voice_id ?? "").trim();
  if (!saved || APP_VOICE_IDS.has(saved) || saved.startsWith("placeholder-")) {
    return { provider: "vapi", voiceId: "Elliot" };
  }
  return { provider: "11labs", voiceId: saved };
}

function buildSystemPrompt(c: Record<string, any>): string {
  const businessName = c.business_name ?? "the business";
  const industry = c.industry ?? "service business";
  const tone = c.tone ?? "Friendly";
  const questions = (c.intake_questions ?? []) as string[];
  const services = (c.services ?? []) as string[];
  const lines: string[] = [];
  lines.push(`You are a professional AI receptionist for ${c.include_business_name === false ? "a " + industry + " business" : businessName}.`);
  lines.push(`Industry: ${industry}. Tone: ${tone}. Speak naturally, warmly, and concisely.`);
  lines.push("");
  lines.push("Answer the call, capture lead information, and let the caller know someone will follow up shortly.");
  if (services.length) lines.push(`Services offered: ${services.join(", ")}.`);
  if (questions.length) {
    lines.push("");
    lines.push("Ask the caller these questions, one at a time, in a natural conversational way:");
    questions.forEach((q: string, i: number) => lines.push(`${i + 1}. ${q}`));
  }
  lines.push("");
  lines.push("Scheduling:");
  lines.push("- Once you have the caller's name, phone, address, and the issue, offer to book a time on the calendar.");
  lines.push("- Call the `findSlots` tool to get real availability, then read 2-3 options aloud (e.g. 'Tuesday at 10am or Wednesday at 2pm').");
  lines.push("- When the caller picks one, call the `bookSlot` tool with the exact ISO start/end times from findSlots plus the captured customer details.");
  lines.push("- After booking, confirm the date/time back to the caller and tell them they will receive a text confirmation.");
  lines.push("- If no times work, take the lead details and tell them the team will call back to schedule.");
  lines.push("");
  lines.push("Never invent pricing, availability, or promises. If unsure, say the team will follow up.");
  return lines.join("\n");
}
function buildGreeting(c: Record<string, any>): string {
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
  return list.body.find((p: any) => {
    const n = normalizePhone(p?.number);
    return n === target || n.endsWith(target) || target.endsWith(n);
  }) ?? null;
}

async function upsertAssistant(client: Record<string, any>, apiKey: string, webhookUrl: string, webhookSecret?: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const toolsUrl = `${supabaseUrl}/functions/v1/vapi-tools`;
  const tools = [
    {
      type: "function",
      async: false,
      function: {
        name: "findSlots",
        description: "Get real available appointment times from the business's Google Calendar. Call this before offering times to the caller.",
        parameters: {
          type: "object",
          properties: {
            days: { type: "number", description: "How many days out to search (1-14). Default 5." },
            max: { type: "number", description: "Max number of slots to return (1-10). Default 6." },
          },
        },
      },
      server: { url: toolsUrl, ...(webhookSecret ? { secret: webhookSecret } : {}) },
    },
    {
      type: "function",
      async: false,
      function: {
        name: "bookSlot",
        description: "Book the chosen appointment on the business's Google Calendar. Use exact ISO start/end times returned by findSlots.",
        parameters: {
          type: "object",
          required: ["start_iso", "end_iso", "customer_name", "customer_phone"],
          properties: {
            start_iso: { type: "string", description: "ISO 8601 start datetime from findSlots." },
            end_iso: { type: "string", description: "ISO 8601 end datetime from findSlots." },
            customer_name: { type: "string" },
            customer_phone: { type: "string", description: "E.164 if possible." },
            customer_email: { type: "string" },
            customer_address: { type: "string" },
            service: { type: "string", description: "What service the appointment is for." },
            notes: { type: "string", description: "Any extra context for the technician." },
          },
        },
      },
      server: { url: toolsUrl, ...(webhookSecret ? { secret: webhookSecret } : {}) },
    },
  ];
  const payload = {
    name: `Vektuor — ${client.business_name ?? "Tenant"}`.slice(0, 40),
    firstMessage: buildGreeting(client),
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: buildSystemPrompt(client) }],
      tools,
    },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const phoneNumber = String(body.phone_number ?? "").trim();
    const clientId = String(body.client_id ?? "").trim();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = () => new Date().toISOString();
    const logStep = async (step: string, status: "ok" | "error" | "skipped", detail: Record<string, unknown> = {}) => {
      console[status === "error" ? "error" : "log"]("[phone-provision]", step, status, {
        client_id: clientId || null,
        phone_number: phoneNumber || null,
        ...detail,
      });
      if (!clientId) return;
      await admin
        .from("callcapture_webhook_events")
        .insert({
          client_id: clientId,
          step,
          status,
          detail: { phone_number: phoneNumber, ...detail },
        })
        .then(() => undefined, () => undefined);
    };

    if (!/^\+\d{6,15}$/.test(phoneNumber)) {
      return json({ error_code: "bad_request", error: "phone_number must be E.164 format" }, 400);
    }
    if (!clientId) return json({ error_code: "bad_request", error: "client_id required" }, 400);
    await logStep("phone_number_selected", "ok", { selected_number: phoneNumber });

    // Verify caller owns the client (use service role to bypass RLS for full row)
    const { data: clientRow, error: clientErr } = await userClient
      .from("callcapture_clients")
      .select("id, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr || !clientRow || clientRow.user_id !== userId) {
      await logStep("tenant_verified", "error", { error: clientErr?.message ?? "Client not found" });
      return json({ error_code: "not_found", error: "Client not found" }, 404);
    }
    const { data: fullClient } = await admin.from("callcapture_clients").select("*").eq("id", clientId).maybeSingle();
    if (!fullClient) return json({ error_code: "not_found", error: "Client not found" }, 404);
    await logStep("tenant_verified", "ok", { business_name: (fullClient as any).business_name ?? null });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const WEBHOOK_SECRET = Deno.env.get("VAPI_WEBHOOK_SECRET") ?? "";
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vapi-webhook`;
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !VAPI_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      const error = "Phone provider is missing required configuration.";
      await logStep("provider_configuration", "error", {
        missing: {
          lovable_api_key: !LOVABLE_API_KEY,
          twilio_api_key: !TWILIO_API_KEY,
          vapi_api_key: !VAPI_API_KEY,
          twilio_account_sid: !TWILIO_ACCOUNT_SID,
          twilio_auth_token: !TWILIO_AUTH_TOKEN,
        },
      });
      await admin.from("callcapture_clients").update({
        number_status: "needs_configuration",
        webhook_status: "failed",
        last_vapi_sync_at: now(),
        last_vapi_sync_status: error,
      }).eq("id", clientId);
      return json({ error_code: "missing_secret", error }, 500);
    }
    await logStep("provider_configuration", "ok");

    await admin.from("callcapture_clients").update({
      assigned_callcapture_number: phoneNumber,
      number_status: "provisioning",
      webhook_status: "pending",
      last_vapi_sync_at: now(),
      last_vapi_sync_status: "Phone number provisioning started.",
    }).eq("id", clientId);

    const twilioHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // 1) Purchase number via Twilio connector gateway
    const purchaseBody = new URLSearchParams({
      PhoneNumber: phoneNumber,
      FriendlyName: ((fullClient as any).business_name ?? "Vektuor").slice(0, 64),
    });
    const r = await retryFetch("twilio purchase", `${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
      method: "POST",
      headers: twilioHeaders,
      body: purchaseBody,
    });
    const data = await parseBody(r) ?? {};
    if (!r.ok) {
      await logStep("phone_purchase", "error", { status: r.status, response: data });
      const code =
        r.status === 401 || r.status === 403 ? "twilio_auth_failed" : "purchase_failed";
      await admin.from("callcapture_clients").update({
        number_status: "needs_configuration",
        webhook_status: "failed",
        last_vapi_sync_at: now(),
        last_vapi_sync_status: data?.message ?? "Phone number purchase failed.",
      }).eq("id", clientId);
      return json({ error_code: code, error: data?.message ?? "Purchase failed", status: r.status }, 502);
    }

    const sid: string = data.sid;
    await logStep("phone_purchase", "ok", { twilio_phone_number_sid: sid });

    // 2) Create/update a PER-TENANT Vapi assistant with webhook configured.
    let assistantId: string | null = null;
    let assistantError: string | null = null;
    const a = await upsertAssistant(fullClient as any, VAPI_API_KEY, webhookUrl, WEBHOOK_SECRET || undefined);
    assistantId = a.id || null;
    assistantError = a.error;
    if (assistantError) {
      await logStep("assistant_upsert", "error", { error: assistantError, voice_id: (fullClient as any).voice_id ?? null });
    } else {
      await logStep("assistant_upsert", "ok", { assistant_id: assistantId, voice: voicePayload(fullClient as any) });
    }

    // 3) Register the Twilio number with Vapi (BYO Twilio) so Vapi answers inbound calls.
    let vapiPhoneNumberId: string | null = null;
    let routing_status: "active" | "needs_configuration" = "needs_configuration";
    let routing_error: string | null = null;
    if (assistantId) {
      try {
        const existing = await findVapiPhoneNumber(VAPI_API_KEY, phoneNumber);
        if (existing?.id) {
          const patch = await vapiFetch(VAPI_API_KEY, `/phone-number/${existing.id}`, {
            method: "PATCH",
            body: JSON.stringify({ assistantId }),
          });
          if (patch.ok) {
            vapiPhoneNumberId = existing.id;
            routing_status = "active";
            await logStep("provider_register", "ok", { vapi_phone_number_id: vapiPhoneNumberId, mode: "existing_patch" });
          } else {
            routing_error = `Vapi phone-number PATCH failed (${patch.status}): ${JSON.stringify(patch.body)}`;
            await logStep("provider_register", "error", { error: routing_error });
          }
        }

        if (!vapiPhoneNumberId) {
          const reg = await retryFetch("vapi phone register", `${VAPI_URL}/phone-number`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "twilio",
            number: phoneNumber,
            twilioAccountSid: TWILIO_ACCOUNT_SID,
            twilioAuthToken: TWILIO_AUTH_TOKEN,
            name: ((fullClient as any).business_name ?? "Vektuor").slice(0, 40),
            assistantId,
          }),
          });
          const regData = await parseBody(reg) ?? {};
          if (reg.ok && regData?.id) {
            vapiPhoneNumberId = regData.id;
            routing_status = "active";
            await logStep("provider_register", "ok", { vapi_phone_number_id: vapiPhoneNumberId, mode: "created" });
          } else {
            const fallback = await findVapiPhoneNumber(VAPI_API_KEY, phoneNumber);
            if (fallback?.id) {
              const patch = await vapiFetch(VAPI_API_KEY, `/phone-number/${fallback.id}`, {
                method: "PATCH",
                body: JSON.stringify({ assistantId }),
              });
              if (patch.ok) {
                vapiPhoneNumberId = fallback.id;
                routing_status = "active";
                await logStep("provider_register", "ok", { vapi_phone_number_id: vapiPhoneNumberId, mode: "fallback_patch" });
              } else {
                routing_error = `Vapi register failed (${reg.status}): ${JSON.stringify(regData)}; fallback PATCH failed (${patch.status}): ${JSON.stringify(patch.body)}`;
                await logStep("provider_register", "error", { error: routing_error });
              }
            } else {
              routing_error = `Vapi register failed (${reg.status}): ${regData?.message ?? JSON.stringify(regData) ?? "unknown"}`;
              await logStep("provider_register", "error", { status: reg.status, response: regData, error: routing_error });
            }
          }
        }
      } catch (e) {
        routing_error = (e as Error).message;
        await logStep("provider_register", "error", { error: routing_error });
      }
    } else {
      routing_error = assistantError ?? "Assistant creation failed — call routing not connected.";
      await logStep("provider_register", "skipped", { reason: routing_error });
    }

    // 4) Configure the Twilio Voice/SMS webhook so inbound calls reach Vapi.
    const voiceUrl = "https://api.vapi.ai/twilio/inbound_call";
    const smsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vapi-webhook?kind=sms`;
    let webhookConfigured = false;
    try {
      const upd = new URLSearchParams({
        VoiceUrl: voiceUrl,
        VoiceMethod: "POST",
        SmsUrl: smsUrl,
        SmsMethod: "POST",
      });
      const wRes = await retryFetch("twilio webhook update", `${GATEWAY_URL}/IncomingPhoneNumbers/${sid}.json`, {
        method: "POST",
        headers: twilioHeaders,
        body: upd,
      });
      const wData = await parseBody(wRes);
      if (wRes.ok) {
        webhookConfigured = true;
        await logStep("webhook_configured", "ok", { voice_url: voiceUrl, sms_url: smsUrl });
      } else {
        const webhookError = `Twilio webhook update failed (${wRes.status}): ${JSON.stringify(wData)}`;
        routing_error = routing_error ? `${routing_error}; ${webhookError}` : webhookError;
        routing_status = "needs_configuration";
        await logStep("webhook_configured", "error", { status: wRes.status, response: wData, error: webhookError });
      }
    } catch (e) {
      const webhookError = `Webhook update failed: ${(e as Error).message}`;
      routing_error = routing_error ? `${routing_error}; ${webhookError}` : webhookError;
      routing_status = "needs_configuration";
      await logStep("webhook_configured", "error", { error: webhookError });
    }

    if (routing_status === "active" && !webhookConfigured) {
      routing_status = "needs_configuration";
    }

    // 5) Persist
    const { error: updErr } = await admin
      .from("callcapture_clients")
      .update({
        assigned_callcapture_number: phoneNumber,
        twilio_phone_number_sid: sid,
        vapi_phone_number_id: vapiPhoneNumberId,
        vapi_assistant_id: assistantId,
        number_status: routing_status,
        webhook_status: routing_status === "active" ? "configured" : routing_error ? "failed" : "pending",
        number_provisioned_at: new Date().toISOString(),
        phone_mode: "new",
        webhook_urls: { voice_url: voiceUrl, sms_url: smsUrl },
        last_vapi_sync_at: now(),
        last_vapi_sync_status: routing_status === "active" ? "Phone number configured and ready." : routing_error,
      })
      .eq("id", clientId);
    if (updErr) {
      await logStep("database_save", "error", { error: updErr.message });
      return json(
        { error_code: "db_error", error: "Number purchased but failed to save. Contact support.", sid },
        500,
      );
    }
    await logStep("database_save", "ok", { status: routing_status });
    await logStep(routing_status === "active" ? "phone_ready" : "phone_failed", routing_status === "active" ? "ok" : "error", {
      assistant_id: assistantId,
      vapi_phone_number_id: vapiPhoneNumberId,
      twilio_phone_number_sid: sid,
      routing_error,
    });

    return json({
      phone_number: phoneNumber,
      sid,
      id: vapiPhoneNumberId,
      assistant_id: assistantId,
      status: routing_status,
      routing_error,
      message:
        routing_status === "active"
          ? "Your Vektuor number is live."
          : `Number purchased. Routing pending: ${routing_error ?? "configuration in progress"}`,
    });
  } catch (e) {
    console.error(e);
    return json({ error_code: "exception", error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}