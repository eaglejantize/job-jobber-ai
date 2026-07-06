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

function runDraftOnTheWaySms(
  input: CopilotActionExecutionInput,
): Promise<CopilotActionExecutionResult> {
  const call = input.context.currentCall;
  if (!call) {
    throw new Error("No active work order is selected to draft an SMS.");
  }

  const caller = call.caller_name ?? "there";
  const issue = call.issue_summary ?? "your service request";
  const etaMatch = input.commandText.match(/(\d{1,3})\s*(min|mins|minute|minutes)/i);
  const etaText = etaMatch ? `${etaMatch[1]} minutes` : "about 20 minutes";
  const draft = `Hi ${caller}, this is your technician. I am on the way and should arrive in ${etaText}. I will assist with ${issue}.`;

  return Promise.resolve({
    summary: "On-the-way SMS draft ready.",
    details: draft,
  });
}

function extractJobNoteText(commandText: string): string {
  const byPrefix = commandText.match(/add\s+(?:a\s+)?job\s+note\s*[:-]?\s*(.+)$/i)
    ?? commandText.match(/add\s+note\s*[:-]?\s*(.+)$/i)
    ?? commandText.match(/note\s*[:-]\s*(.+)$/i);

  const extracted = byPrefix?.[1]?.trim() ?? "";
  return extracted;
}

async function runAddJobNote(
  input: CopilotActionExecutionInput,
): Promise<CopilotActionExecutionResult> {
  const call = input.context.currentCall;
  if (!call) {
    throw new Error("No active work order is selected for adding a note.");
  }

  const noteText = extractJobNoteText(input.commandText);
  if (!noteText) {
    throw new Error("Include note text after the command, for example: add job note: customer requested shoe covers.");
  }

  if (!input.mutationAdapters?.persistJobNote) {
    throw new Error("Job note persistence is not configured.");
  }

  const result = await input.mutationAdapters.persistJobNote({
    callId: call.id,
    noteText,
    userId: input.userId,
  });

  if (!result.success) {
    throw new Error(result.error ?? "Failed to save job note.");
  }

  return {
    summary: "Job note added.",
    details: noteText,
  };
}

const ACTION_REGISTRY: Record<CopilotActionKey, ActionHandler> = {
  navigate_to_next_work_order: runNavigateToNextWorkOrder,
  summarize_current_job: runSummarizeCurrentJob,
  draft_on_the_way_sms: runDraftOnTheWaySms,
  add_job_note: runAddJobNote,
};

export function getActionHandler(actionKey: CopilotActionKey): ActionHandler {
  return ACTION_REGISTRY[actionKey];
}

export function getSafeActionKeys(): CopilotActionKey[] {
  return Object.keys(ACTION_REGISTRY) as CopilotActionKey[];
}
