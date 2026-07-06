import { getActionHandler } from "@/copilot/actionRegistry";
import { getMissingContextKeys } from "@/copilot/contextResolver";
import { resolveIntentFromText } from "@/copilot/intentRegistry";
import { evaluateActionPolicy } from "@/copilot/policyEngine";
import type {
  CopilotExecutionStatus,
  CopilotIntentKey,
  RouteCommandInput,
  RouteCommandResult,
} from "@/copilot/types";

function toContextSnapshot(input: RouteCommandInput): Record<string, unknown> {
  return {
    callCount: input.context.calls.length,
    currentCallId: input.context.currentCallId,
    currentCallStatus: input.context.currentCall?.status ?? null,
  };
}

async function writeAuditIfAvailable(
  input: RouteCommandInput,
  payload: {
    status: CopilotExecutionStatus;
    intentKey: CopilotIntentKey | null;
    actionKey: CopilotIntentKey | null;
    policyReason: string | null;
    resultSummary: string | null;
    errorMessage: string | null;
  },
): Promise<{ auditLogId: string | null; auditLogError: string | null }> {
  if (!input.writeExecutionAudit) {
    return { auditLogId: null, auditLogError: null };
  }

  const { id, error } = await input.writeExecutionAudit({
    userId: input.userId,
    clientId: input.clientId,
    commandText: input.commandText,
    intentKey: payload.intentKey,
    actionKey: payload.actionKey,
    status: payload.status,
    policyReason: payload.policyReason,
    resultSummary: payload.resultSummary,
    contextSnapshot: toContextSnapshot(input),
    errorMessage: payload.errorMessage,
  });

  return {
    auditLogId: id,
    auditLogError: error,
  };
}

export async function routeCommand(
  input: RouteCommandInput,
): Promise<RouteCommandResult> {
  const commandText = input.commandText.trim();

  if (!commandText) {
    const audit = await writeAuditIfAvailable(input, {
      status: "blocked",
      intentKey: null,
      actionKey: null,
      policyReason: "Empty command",
      resultSummary: null,
      errorMessage: null,
    });

    return {
      status: "blocked",
      message: "Enter a command to continue.",
      intentKey: null,
      actionKey: null,
      policyReason: "Empty command",
      auditLogId: audit.auditLogId,
      auditLogError: audit.auditLogError,
    };
  }

  const intent = resolveIntentFromText(commandText);
  if (!intent) {
    const audit = await writeAuditIfAvailable(input, {
      status: "blocked",
      intentKey: null,
      actionKey: null,
      policyReason: "No intent match",
      resultSummary: null,
      errorMessage: null,
    });

    return {
      status: "blocked",
      message: "No safe copilot intent matched that command.",
      intentKey: null,
      actionKey: null,
      policyReason: "No intent match",
      auditLogId: audit.auditLogId,
      auditLogError: audit.auditLogError,
    };
  }

  // PR1 explicitly blocks mutating actions until strict audit guarantees are in place.
  if (intent.executionKind === "mutate") {
    const reason = "Mutating actions are disabled in PR1 until strict audit enforcement ships.";
    const audit = await writeAuditIfAvailable(input, {
      status: "blocked",
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: reason,
      resultSummary: null,
      errorMessage: null,
    });

    return {
      status: "blocked",
      message: "Command blocked by PR1 safety policy.",
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: reason,
      auditLogId: audit.auditLogId,
      auditLogError: audit.auditLogError,
    };
  }

  const policy = await evaluateActionPolicy({
    actionKey: intent.actionKey,
    clientId: input.clientId,
    fetchAllowedActions: input.fetchAllowedActions,
  });

  if (!policy.allowed) {
    const audit = await writeAuditIfAvailable(input, {
      status: "blocked",
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: policy.reason,
      resultSummary: null,
      errorMessage: null,
    });

    return {
      status: "blocked",
      message: "Command blocked by copilot policy.",
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: policy.reason,
      auditLogId: audit.auditLogId,
      auditLogError: audit.auditLogError,
    };
  }

  const missingContext = getMissingContextKeys(intent.requiredContext, input.context);
  if (missingContext.length > 0) {
    const reason = `Missing required context: ${missingContext.join(", ")}`;
    const audit = await writeAuditIfAvailable(input, {
      status: "blocked",
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: reason,
      resultSummary: null,
      errorMessage: null,
    });

    return {
      status: "blocked",
      message: "Command blocked because required context is unavailable.",
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: reason,
      auditLogId: audit.auditLogId,
      auditLogError: audit.auditLogError,
    };
  }

  try {
    const actionHandler = getActionHandler(intent.actionKey);
    const actionResult = await actionHandler({ context: input.context });

    const audit = await writeAuditIfAvailable(input, {
      status: "success",
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: policy.reason,
      resultSummary: actionResult.summary,
      errorMessage: null,
    });

    // TODO(phase-2): For mutating actions, block execution if audit cannot be written.
    // This router currently allows only read actions.

    return {
      status: "success",
      message: actionResult.summary,
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: policy.reason,
      navigationTargetCallId: actionResult.navigationTargetCallId,
      auditLogId: audit.auditLogId,
      auditLogError: audit.auditLogError,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown command execution error.";
    const audit = await writeAuditIfAvailable(input, {
      status: "error",
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: policy.reason,
      resultSummary: null,
      errorMessage,
    });

    return {
      status: "error",
      message: "Command execution failed.",
      intentKey: intent.intentKey,
      actionKey: intent.actionKey,
      policyReason: policy.reason,
      auditLogId: audit.auditLogId,
      auditLogError: audit.auditLogError,
    };
  }
}
