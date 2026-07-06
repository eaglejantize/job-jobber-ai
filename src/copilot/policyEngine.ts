import { getSafeActionKeys } from "@/copilot/actionRegistry";
import type {
  CopilotActionKey,
  CopilotPolicyDecision,
  FetchAllowedActions,
} from "@/copilot/types";

export async function evaluateActionPolicy(input: {
  actionKey: CopilotActionKey;
  clientId: string | null;
  fetchAllowedActions?: FetchAllowedActions;
}): Promise<CopilotPolicyDecision> {
  if (!getSafeActionKeys().includes(input.actionKey)) {
    return {
      allowed: false,
      reason: "Requested action is outside the safe allowlist.",
    };
  }

  if (!input.fetchAllowedActions) {
    return {
      allowed: true,
      reason: "Allowed by local safe action allowlist.",
    };
  }

  const rows = await input.fetchAllowedActions(input.actionKey, input.clientId);

  if (!rows.length) {
    return {
      allowed: false,
      reason: "Action is not enabled for this account.",
    };
  }

  const clientSpecific = rows.find(
    (row) => row.client_id === input.clientId,
  );
  if (clientSpecific) {
    return {
      allowed: clientSpecific.is_enabled,
      reason: clientSpecific.is_enabled
        ? "Action allowed by client-specific policy."
        : "Action disabled by client-specific policy.",
    };
  }

  const globalRule = rows.find((row) => row.client_id === null);
  if (!globalRule) {
    return {
      allowed: false,
      reason: "No matching action policy found.",
    };
  }

  return {
    allowed: globalRule.is_enabled,
    reason: globalRule.is_enabled
      ? "Action allowed by global policy."
      : "Action disabled by global policy.",
  };
}
