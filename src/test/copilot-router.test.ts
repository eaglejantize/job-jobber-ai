import { describe, expect, it, vi } from "vitest";
import { resolveCopilotContext } from "@/copilot/contextResolver";
import { routeCommand } from "@/copilot/commandRouter";
import type { AllowedActionRow, CopilotAuditRecord } from "@/copilot/types";
import type { CallRow } from "@/hooks/useDashboardData";

function makeCalls(): CallRow[] {
  return [
    {
      id: "call-1",
      client_id: "client-1",
      caller_name: "Alice",
      caller_phone: "+155555501",
      issue_summary: "No heat on first floor",
      status: "new",
      started_at: "2026-07-06T10:00:00.000Z",
      ended_at: null,
      duration_seconds: null,
      lead_id: null,
    },
    {
      id: "call-2",
      client_id: "client-1",
      caller_name: "Bob",
      caller_phone: "+155555502",
      issue_summary: "Thermostat short cycling",
      status: "live",
      started_at: "2026-07-06T11:00:00.000Z",
      ended_at: null,
      duration_seconds: null,
      lead_id: null,
    },
  ];
}

function allowAllRows(): AllowedActionRow[] {
  return [
    {
      action_key: "navigate_to_next_work_order",
      role: "authenticated",
      client_id: null,
      is_enabled: true,
    },
    {
      action_key: "summarize_current_job",
      role: "authenticated",
      client_id: null,
      is_enabled: true,
    },
  ];
}

describe("copilot command router", () => {
  it("routes next work order command and returns navigation target", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    const result = await routeCommand({
      commandText: "next work order",
      userId: "user-1",
      clientId: "client-1",
      context,
      fetchAllowedActions: async () => allowAllRows(),
      writeExecutionAudit: async () => ({ id: "audit-1", error: null }),
    });

    expect(result.status).toBe("success");
    expect(result.intentKey).toBe("navigate_to_next_work_order");
    expect(result.navigationTargetCallId).toBe("call-2");
    expect(result.auditLogId).toBe("audit-1");
  });

  it("blocks when policy does not allow the action", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    const result = await routeCommand({
      commandText: "next work order",
      userId: "user-1",
      clientId: "client-1",
      context,
      fetchAllowedActions: async () => [
        {
          action_key: "navigate_to_next_work_order",
          role: "authenticated",
          client_id: "client-1",
          is_enabled: false,
        },
      ],
      writeExecutionAudit: async () => ({ id: "audit-2", error: null }),
    });

    expect(result.status).toBe("blocked");
    expect(result.policyReason).toContain("disabled");
  });

  it("blocks when required context is missing", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: null,
    });

    const result = await routeCommand({
      commandText: "summarize current job",
      userId: "user-1",
      clientId: "client-1",
      context,
      fetchAllowedActions: async () => allowAllRows(),
      writeExecutionAudit: async () => ({ id: "audit-3", error: null }),
    });

    expect(result.status).toBe("blocked");
    expect(result.policyReason).toContain("Missing required context");
  });

  it("writes audit entries for blocked and successful routes", async () => {
    const writeExecutionAudit = vi.fn(async (_record: CopilotAuditRecord) => ({
      id: "audit-4",
      error: null,
    }));

    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    await routeCommand({
      commandText: "unsupported task",
      userId: "user-1",
      clientId: "client-1",
      context,
      fetchAllowedActions: async () => allowAllRows(),
      writeExecutionAudit,
    });

    await routeCommand({
      commandText: "summarize current job",
      userId: "user-1",
      clientId: "client-1",
      context,
      fetchAllowedActions: async () => allowAllRows(),
      writeExecutionAudit,
    });

    expect(writeExecutionAudit).toHaveBeenCalledTimes(2);
    expect(writeExecutionAudit.mock.calls[0][0].status).toBe("blocked");
    expect(writeExecutionAudit.mock.calls[1][0].status).toBe("success");
  });
});
