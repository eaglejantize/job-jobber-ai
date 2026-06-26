// Shared helpers for Vapi assistant + phone-number setup, per tenant.

export const VAPI_URL = "https://api.vapi.ai";

export function buildSystemPrompt(c: Record<string, unknown>): string {
  const businessName = (c.business_name as string) ?? "the business";
  const industry = (c.industry as string) ?? "service business";
  const tone = (c.tone as string) ?? "Friendly";
  const includeName = c.include_business_name as boolean | undefined;
  const questions = ((c.intake_questions as string[] | null) ?? []) as string[];
  const services = ((c.services as string[] | null) ?? []) as string[];

  const lines: string[] = [];
  lines.push(`You are a professional AI receptionist for ${includeName === false ? "a " + industry + " business" : businessName}.`);
  lines.push(`Industry: ${industry}. Tone: ${tone}. Speak naturally, warmly, and concisely.`);
  lines.push("");
  lines.push("Your job is to answer the call, capture lead information, and let the caller know someone will follow up shortly.");
  if (services.length) {
    lines.push(`Services offered: ${services.join(", ")}.`);
  }
  if (questions.length) {
    lines.push("");
    lines.push("Ask the caller these questions, one at a time, in a natural conversational way:");
    questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  }
  lines.push("");
  lines.push("At the END of the call, ALWAYS call the submitIntake tool with the collected fields.");
  lines.push("Never invent pricing, availability, or promises. If unsure, say the team will follow up.");
  return lines.join("\n");
}

export function buildGreeting(c: Record<string, unknown>): string {
  const existing = (c.greeting as string | null) ?? "";
  if (existing) return existing;
  const name = (c.business_name as string) ?? "our office";
  if (c.industry === "med_spa") return `Thank you for calling ${name}, your personal concierge is here. How may I assist you today?`;
  return `Thanks for calling ${name}. How can I help you today?`;
}

export async function vapiFetch(path: string, init: RequestInit & { apiKey: string }) {
  const { apiKey, headers, ...rest } = init as any;
  const r = await fetch(`${VAPI_URL}${path}`, {
    ...rest,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(headers ?? {}) },
  });
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}

/** Create or update a Vapi assistant tailored to this client. Returns assistant id. */
export async function upsertAssistant(client: Record<string, any>, opts: { apiKey: string; webhookUrl: string; webhookSecret?: string; }): Promise<{ id: string; created: boolean; error?: string }> {
  const systemPrompt = buildSystemPrompt(client);
  const firstMessage = buildGreeting(client);
  const voiceId = (client.voice_id as string | null) ?? null;

  const payload: Record<string, unknown> = {
    name: `Vektuor — ${client.business_name ?? "Tenant"}`.slice(0, 40),
    firstMessage,
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }],
    },
    voice: voiceId ? { provider: "11labs", voiceId } : { provider: "vapi", voiceId: "Elliot" },
    server: {
      url: opts.webhookUrl,
      ...(opts.webhookSecret ? { secret: opts.webhookSecret } : {}),
    },
    serverMessages: ["status-update", "transcript", "end-of-call-report", "conversation-update", "tool-calls"],
    metadata: { client_id: client.id, user_id: client.user_id },
  };

  // If we already have one, PATCH it.
  if (client.vapi_assistant_id) {
    const upd = await vapiFetch(`/assistant/${client.vapi_assistant_id}`, { method: "PATCH", apiKey: opts.apiKey, body: JSON.stringify(payload) });
    if (upd.ok && upd.body?.id) return { id: upd.body.id, created: false };
    // fall through to create if not found
  }

  const created = await vapiFetch(`/assistant`, { method: "POST", apiKey: opts.apiKey, body: JSON.stringify(payload) });
  if (!created.ok || !created.body?.id) {
    return { id: "", created: false, error: `assistant create failed (${created.status}): ${JSON.stringify(created.body)}` };
  }
  return { id: created.body.id, created: true };
}

/** Register a Twilio number with Vapi BYO, attaching the per-tenant assistant. */
export async function registerVapiPhoneNumber(opts: {
  apiKey: string;
  phoneNumber: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  assistantId: string;
  name: string;
}) {
  return await vapiFetch(`/phone-number`, {
    method: "POST",
    apiKey: opts.apiKey,
    body: JSON.stringify({
      provider: "twilio",
      number: opts.phoneNumber,
      twilioAccountSid: opts.twilioAccountSid,
      twilioAuthToken: opts.twilioAuthToken,
      assistantId: opts.assistantId,
      name: opts.name.slice(0, 40),
    }),
  });
}

/** Update an existing Vapi phone number (assistantId, etc.). */
export async function updateVapiPhoneNumber(id: string, opts: { apiKey: string; assistantId: string }) {
  return await vapiFetch(`/phone-number/${id}`, {
    method: "PATCH",
    apiKey: opts.apiKey,
    body: JSON.stringify({ assistantId: opts.assistantId }),
  });
}