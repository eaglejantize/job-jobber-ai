import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { writeCopilotExecutionAudit } from "../_shared/copilot-audit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const TOKEN_TTL_MS = 5 * 60 * 1000;
const MUTATING_ACTIONS = new Set(["add_job_note"]);

type CopilotExecuteRequest = {
  mode: "issue_token" | "confirm_execute";
  action_key?: string;
  command_text?: string;
  token_id?: string;
  client_id?: string;
  call_id?: string;
};

type JsonBody = Record<string, unknown>;

function json(body: JsonBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeCommandText(commandText: string): string {
  return commandText.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractJobNoteText(commandText: string): string {
  const byPrefix = commandText.match(/add\s+(?:a\s+)?job\s+note\s*[:-]?\s*(.+)$/i)
    ?? commandText.match(/add\s+note\s*[:-]?\s*(.+)$/i)
    ?? commandText.match(/note\s*[:-]\s*(.+)$/i);

  return byPrefix?.[1]?.trim() ?? "";
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function computeCommandHash(input: {
  actionKey: string;
  commandText: string;
  callId: string;
}): Promise<string> {
  const canonical = JSON.stringify({
    actionKey: input.actionKey,
    commandText: normalizeCommandText(input.commandText),
    callId: input.callId,
  });
  return sha256Hex(canonical);
}

function getContextSnapshot(input: {
  callId: string;
  confirmationTokenProvided: boolean;
}): Record<string, unknown> {
  return {
    currentCallId: input.callId,
    confirmationTokenProvided: input.confirmationTokenProvided,
  };
}

async function resolveAuthenticatedUser(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data } = await userClient.auth.getUser();
  return data.user ? { id: data.user.id } : null;
}

async function assertOwnedClientId(admin: ReturnType<typeof createClient>, userId: string, clientId: string): Promise<boolean> {
  const { data } = await admin
    .from("callcapture_clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data?.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const user = await resolveAuthenticatedUser(req);
    if (!user) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as CopilotExecuteRequest;
    const mode = body.mode;
    const actionKey = String(body.action_key ?? "").trim();
    const commandText = String(body.command_text ?? "").trim();
    const clientId = String(body.client_id ?? "").trim();
    const callId = String(body.call_id ?? "").trim();

    if (!mode || !actionKey || !commandText || !clientId) {
      return json({ ok: false, error: "mode, action_key, command_text, and client_id are required" }, 400);
    }

    if (!MUTATING_ACTIONS.has(actionKey)) {
      return json({ ok: false, error: "Action is not eligible for confirmation token flow" }, 400);
    }

    if (!callId) {
      return json({ ok: false, error: "call_id is required for mutate confirmation flow" }, 400);
    }

    const ownsClient = await assertOwnedClientId(admin, user.id, clientId);
    if (!ownsClient) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }

    if (mode === "issue_token") {
      const commandHash = await computeCommandHash({
        actionKey,
        commandText,
        callId,
      });

      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
      const { data, error } = await admin
        .from("assistant_confirmation_tokens")
        .insert({
          user_id: user.id,
          client_id: clientId,
          action_key: actionKey,
          command_hash: commandHash,
          expires_at: expiresAt,
        })
        .select("id, expires_at")
        .maybeSingle();

      if (error || !data?.id) {
        return json({ ok: false, error: error?.message ?? "Failed to issue token" }, 500);
      }

      return json({
        ok: true,
        token_id: data.id,
        expires_at: data.expires_at,
      });
    }

    if (mode !== "confirm_execute") {
      return json({ ok: false, error: "Unsupported mode" }, 400);
    }

    const tokenId = String(body.token_id ?? "").trim();
    if (!tokenId) {
      return json({ ok: false, error: "token_id is required" }, 400);
    }

    const commandHash = await computeCommandHash({
      actionKey,
      commandText,
      callId,
    });

    const nowIso = new Date().toISOString();
    const { data: consumedToken, error: consumeError } = await admin
      .from("assistant_confirmation_tokens")
      .update({ used_at: nowIso })
      .eq("id", tokenId)
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .eq("action_key", actionKey)
      .eq("command_hash", commandHash)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .select("id")
      .maybeSingle();

    if (consumeError || !consumedToken?.id) {
      return json({
        ok: false,
        status: "blocked",
        message: "Confirmation failed. Please run the command again.",
        policy_reason: "Confirmation token is invalid, expired, or already used.",
        audit_log_id: null,
        audit_log_error: consumeError?.message ?? null,
      }, 409);
    }

    if (actionKey !== "add_job_note") {
      return json({
        ok: false,
        status: "blocked",
        message: "Command blocked by copilot policy.",
        policy_reason: "Unsupported mutate action.",
        audit_log_id: null,
        audit_log_error: null,
      }, 400);
    }

    const noteText = extractJobNoteText(commandText);
    if (!noteText) {
      return json({
        ok: false,
        status: "blocked",
        message: "Include note text after the command.",
        policy_reason: "Missing note text.",
        audit_log_id: null,
        audit_log_error: null,
      }, 400);
    }

    const { data: callRow, error: callSelectError } = await admin
      .from("callcapture_calls")
      .select("metadata")
      .eq("id", callId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (callSelectError || !callRow) {
      return json({
        ok: false,
        status: "error",
        message: "Command execution failed.",
        policy_reason: "Unable to load selected call.",
        audit_log_id: null,
        audit_log_error: callSelectError?.message ?? null,
      }, 500);
    }

    const metadata = (callRow as { metadata?: Record<string, unknown> | null }).metadata ?? {};
    const existingNotes = Array.isArray(metadata.assistant_job_notes) ? metadata.assistant_job_notes : [];
    const updatedMetadata = {
      ...metadata,
      assistant_job_notes: [
        ...existingNotes,
        {
          text: noteText,
          author_user_id: user.id,
          created_at: new Date().toISOString(),
        },
      ],
    };

    const { error: updateError } = await admin
      .from("callcapture_calls")
      .update({ metadata: updatedMetadata })
      .eq("id", callId)
      .eq("client_id", clientId);

    if (updateError) {
      return json({
        ok: false,
        status: "error",
        message: "Command execution failed.",
        policy_reason: "Failed to persist job note.",
        audit_log_id: null,
        audit_log_error: updateError.message,
      }, 500);
    }

    const audit = await writeCopilotExecutionAudit(admin, {
      userId: user.id,
      clientId,
      commandText,
      intentKey: "add_job_note",
      actionKey,
      status: "success",
      policyReason: "Mutate action executed via server-backed confirmation token.",
      resultSummary: "Job note added.",
      contextSnapshot: getContextSnapshot({
        callId,
        confirmationTokenProvided: true,
      }),
      errorMessage: null,
    });

    if (audit.error) {
      const rollback = await admin
        .from("callcapture_calls")
        .update({ metadata })
        .eq("id", callId)
        .eq("client_id", clientId);

      return json({
        ok: false,
        status: "blocked",
        message: "Command blocked because audit logging failed.",
        policy_reason: "Mutating action requires successful audit persistence.",
        audit_log_id: null,
        audit_log_error: rollback.error
          ? `${audit.error}; rollback failed: ${rollback.error.message}`
          : audit.error,
      }, 500);
    }

    return json({
      ok: true,
      status: "success",
      message: "Job note added.",
      details: noteText,
      policy_reason: "Mutate action executed with confirmed single-use token.",
      audit_log_id: audit.id,
      audit_log_error: audit.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ ok: false, error: message }, 500);
  }
});
