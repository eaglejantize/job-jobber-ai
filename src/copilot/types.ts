import type { CallRow } from "@/hooks/useDashboardData";

export type CopilotIntentKey =
  | "navigate_to_next_work_order"
  | "summarize_current_job"
  | "draft_on_the_way_sms"
  | "add_job_note";

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

export type IssueConfirmationTokenInput = {
  actionKey: CopilotActionKey;
  commandText: string;
  userId: string;
  clientId: string | null;
  context: CopilotContext;
};

export type IssueConfirmationTokenResult = {
  tokenId: string;
  expiresAt: string;
  error?: string | null;
};

export type IssueConfirmationToken = (
  input: IssueConfirmationTokenInput,
) => Promise<IssueConfirmationTokenResult>;

export type ExecuteMutatingActionInput = {
  tokenId: string;
  actionKey: CopilotActionKey;
  commandText: string;
  userId: string;
  clientId: string | null;
  context: CopilotContext;
};

export type ExecuteMutatingActionResult = {
  status: CopilotExecutionStatus;
  message: string;
  details?: string;
  policyReason: string | null;
  auditLogId: string | null;
  auditLogError: string | null;
};

export type ExecuteMutatingAction = (
  input: ExecuteMutatingActionInput,
) => Promise<ExecuteMutatingActionResult>;

export type CopilotActionExecutionInput = {
  context: CopilotContext;
  commandText: string;
  userId: string;
  mutationAdapters?: {
    persistJobNote?: (input: {
      callId: string;
      noteText: string;
      userId: string;
    }) => Promise<{ success: boolean; error?: string | null }>;
  };
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
  confirmationToken?: string | null;
  fetchAllowedActions?: FetchAllowedActions;
  writeExecutionAudit?: WriteExecutionAudit;
  mutationAdapters?: CopilotActionExecutionInput["mutationAdapters"];
  issueConfirmationToken?: IssueConfirmationToken;
  executeMutatingAction?: ExecuteMutatingAction;
};

export type RouteCommandResult = {
  status: CopilotExecutionStatus;
  message: string;
  intentKey: CopilotIntentKey | null;
  actionKey: CopilotActionKey | null;
  policyReason: string | null;
  details?: string;
  navigationTargetCallId?: string;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  confirmationExpiresAt?: string;
  auditLogId: string | null;
  auditLogError: string | null;
};
