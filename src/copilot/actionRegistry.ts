import type {
  CopilotActionExecutionInput,
  CopilotActionExecutionResult,
  CopilotActionKey,
} from "@/copilot/types";

type ActionHandler = (
  input: CopilotActionExecutionInput,
) => Promise<CopilotActionExecutionResult>;

function runNavigateToNextWorkOrder(
  input: CopilotActionExecutionInput,
): Promise<CopilotActionExecutionResult> {
  const { calls, currentCallId } = input.context;

  if (calls.length === 0) {
    throw new Error("No work orders are available to navigate.");
  }

  const currentIndex = currentCallId
    ? calls.findIndex((call) => call.id === currentCallId)
    : -1;
  const nextIndex = currentIndex >= 0
    ? (currentIndex + 1) % calls.length
    : 0;

  const nextCall = calls[nextIndex];
  const caller = nextCall.caller_name ?? "Unknown caller";

  return Promise.resolve({
    summary: `Moved to next work order for ${caller}.`,
    details: `Queue position ${nextIndex + 1} of ${calls.length}.`,
    navigationTargetCallId: nextCall.id,
  });
}

function runSummarizeCurrentJob(
  input: CopilotActionExecutionInput,
): Promise<CopilotActionExecutionResult> {
  const call = input.context.currentCall;
  if (!call) {
    throw new Error("No active work order is selected to summarize.");
  }

  const caller = call.caller_name ?? "Unknown caller";
  const phone = call.caller_phone ?? "No phone provided";
  const issue = call.issue_summary ?? "No issue summary available.";
  const status = call.status;

  return Promise.resolve({
    summary: `Job summary: ${caller} (${phone}) reported: ${issue}`,
    details: `Status: ${status}. Started at ${new Date(call.started_at).toLocaleString()}.`,
  });
}

const ACTION_REGISTRY: Record<CopilotActionKey, ActionHandler> = {
  navigate_to_next_work_order: runNavigateToNextWorkOrder,
  summarize_current_job: runSummarizeCurrentJob,
};

export function getActionHandler(actionKey: CopilotActionKey): ActionHandler {
  return ACTION_REGISTRY[actionKey];
}

export function getSafeActionKeys(): CopilotActionKey[] {
  return Object.keys(ACTION_REGISTRY) as CopilotActionKey[];
}
