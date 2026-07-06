import type { CallRow } from "@/hooks/useDashboardData";
import type { CopilotContext, RequiredContextKey } from "@/copilot/types";

export function resolveCopilotContext(input: {
  calls: CallRow[] | null | undefined;
  currentCallId: string | null;
}): CopilotContext {
  const calls = input.calls ?? [];
  const currentCall = input.currentCallId
    ? calls.find((call) => call.id === input.currentCallId) ?? null
    : null;

  return {
    calls,
    currentCallId: input.currentCallId,
    currentCall,
  };
}

export function getMissingContextKeys(
  requiredContext: RequiredContextKey[],
  context: CopilotContext,
): RequiredContextKey[] {
  return requiredContext.filter((key) => {
    if (key === "calls") return context.calls.length === 0;
    if (key === "currentCall") return context.currentCall === null;
    return true;
  });
}
