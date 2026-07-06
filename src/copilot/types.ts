import type { CallRow } from "@/hooks/useDashboardData";

export type CopilotIntentKey =
  | "navigate_to_next_work_order"
  | "summarize_current_job";

export type CopilotActionKey = CopilotIntentKey;

export type CopilotActionExecutionKind = "read" | "mutate";

export type CopilotExecutionStatus = "success" | "blocked" | "error";

export type RequiredContextKey = "calls" | "currentCall";

export type CopilotContext = {
  calls: CallRow[];
  currentCallId: string | null;
  currentCall: CallRow | null;
};

export type CopilotIntentDefinition = {
  intentKey: CopilotIntentKey;
  actionKey: CopilotActionKey;
  executionKind: CopilotActionExecutionKind;
  description: string;
  examples: string[];
  requiredContext: RequiredContextKey[];
  matchers: RegExp[];
};

export type CopilotPolicyDecision = {
  allowed: boolean;
  reason: string;
};

export type AllowedActionRow = {
  action_key: CopilotActionKey;
  role: string;
  client_id: string | null;
  is_enabled: boolean;
};

export type FetchAllowedActions = (
  actionKey: CopilotActionKey,
  clientId: string | null,
) => Promise<AllowedActionRow[]>;

export type CopilotActionExecutionInput = {
  context: CopilotContext;
};

export type CopilotActionExecutionResult = {
  summary: string;
  details?: string;
  navigationTargetCallId?: string;
};

export type CopilotAuditRecord = {
  userId: string;
  clientId: string | null;
  commandText: string;
  intentKey: CopilotIntentKey | null;
  actionKey: CopilotActionKey | null;
  status: CopilotExecutionStatus;
  policyReason: string | null;
  resultSummary: string | null;
  contextSnapshot: Record<string, unknown>;
  errorMessage: string | null;
};

export type WriteExecutionAudit = (
  record: CopilotAuditRecord,
) => Promise<{ id: string | null; error: string | null }>;

export type RouteCommandInput = {
  commandText: string;
  userId: string;
  clientId: string | null;
  context: CopilotContext;
  fetchAllowedActions?: FetchAllowedActions;
  writeExecutionAudit?: WriteExecutionAudit;
};

export type RouteCommandResult = {
  status: CopilotExecutionStatus;
  message: string;
  intentKey: CopilotIntentKey | null;
  actionKey: CopilotActionKey | null;
  policyReason: string | null;
  navigationTargetCallId?: string;
  auditLogId: string | null;
  auditLogError: string | null;
};
