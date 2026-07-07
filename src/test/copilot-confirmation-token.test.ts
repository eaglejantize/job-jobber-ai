import { describe, expect, it, vi } from "vitest";
import { resolveCopilotContext } from "@/copilot/contextResolver";
import { routeCommand } from "@/copilot/commandRouter";
import type { AllowedActionRow } from "@/copilot/types";
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
  ];
}

function allowAllRows(): AllowedActionRow[] {
  return [
    {
      action_key: "add_job_note",
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

async function getConfirmationToken(): Promise<string> {
  const context = resolveCopilotContext({
    calls: makeCalls(),
    currentCallId: "call-1",
  });

  const response = await routeCommand({
    commandText: "add job note: customer has dogs",
    userId: "user-1",
    clientId: "client-1",
    context,
    fetchAllowedActions: async () => allowAllRows(),
    writeExecutionAudit: async () => ({ id: "audit-confirm-1", error: null }),
    issueConfirmationToken: async () => ({
      tokenId: "token-1",
      expiresAt: "2026-07-07T00:10:00.000Z",
      error: null,
    }),
  });

  if (!response.confirmationToken) {
    throw new Error("expected confirmation token");
  }

  return response.confirmationToken;
}

describe("server-backed confirmation token routing", () => {
  it("mutate action requests a confirmation token", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    const issueConfirmationToken = vi.fn(async () => ({
      tokenId: "token-issue",
      expiresAt: "2026-07-07T00:10:00.000Z",
      error: null,
    }));

    const result = await routeCommand({
      commandText: "add job note: call before arriving",
      userId: "user-1",
      clientId: "client-1",
      context,
      fetchAllowedActions: async () => allowAllRows(),
      writeExecutionAudit: async () => ({ id: "audit-issue", error: null }),
      issueConfirmationToken,
    });

    expect(result.status).toBe("blocked");
    expect(result.requiresConfirmation).toBe(true);
    expect(result.confirmationToken).toBe("token-issue");
    expect(issueConfirmationToken).toHaveBeenCalledTimes(1);
  });

  it("expired token is rejected", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    const token = await getConfirmationToken();
    const result = await routeCommand({
      commandText: "add job note: customer has dogs",
      userId: "user-1",
      clientId: "client-1",
      context,
      confirmationToken: token,
      fetchAllowedActions: async () => allowAllRows(),
      executeMutatingAction: async () => ({
        status: "blocked",
        message: "Confirmation failed. Please run the command again.",
        policyReason: "Confirmation token is invalid, expired, or already used.",
        auditLogId: null,
        auditLogError: null,
      }),
    });

    expect(result.status).toBe("blocked");
    expect(result.policyReason).toContain("expired");
  });

  it("reused token is rejected", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    const token = await getConfirmationToken();
    const result = await routeCommand({
      commandText: "add job note: customer has dogs",
      userId: "user-1",
      clientId: "client-1",
      context,
      confirmationToken: token,
      fetchAllowedActions: async () => allowAllRows(),
      executeMutatingAction: async () => ({
        status: "blocked",
        message: "Confirmation failed. Please run the command again.",
        policyReason: "Confirmation token is invalid, expired, or already used.",
        auditLogId: null,
        auditLogError: null,
      }),
    });

    expect(result.status).toBe("blocked");
    expect(result.policyReason).toContain("already used");
  });

  it("wrong user token is rejected", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    const token = await getConfirmationToken();
    const result = await routeCommand({
      commandText: "add job note: customer has dogs",
      userId: "user-2",
      clientId: "client-1",
      context,
      confirmationToken: token,
      fetchAllowedActions: async () => allowAllRows(),
      executeMutatingAction: async () => ({
        status: "blocked",
        message: "Confirmation failed. Please run the command again.",
        policyReason: "Confirmation token belongs to a different user.",
        auditLogId: null,
        auditLogError: null,
      }),
    });

    expect(result.status).toBe("blocked");
    expect(result.policyReason).toContain("different user");
  });

  it("wrong action key or command hash is rejected", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    const token = await getConfirmationToken();
    const result = await routeCommand({
      commandText: "add job note: changed payload text",
      userId: "user-1",
      clientId: "client-1",
      context,
      confirmationToken: token,
      fetchAllowedActions: async () => allowAllRows(),
      executeMutatingAction: async () => ({
        status: "blocked",
        message: "Confirmation failed. Please run the command again.",
        policyReason: "Confirmation token does not match action_key or command_hash.",
        auditLogId: null,
        auditLogError: null,
      }),
    });

    expect(result.status).toBe("blocked");
    expect(result.policyReason).toContain("command_hash");
  });

  it("mutate is blocked when audit logging fails", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    const token = await getConfirmationToken();
    const result = await routeCommand({
      commandText: "add job note: customer has dogs",
      userId: "user-1",
      clientId: "client-1",
      context,
      confirmationToken: token,
      fetchAllowedActions: async () => allowAllRows(),
      executeMutatingAction: async () => ({
        status: "blocked",
        message: "Command blocked because audit logging failed.",
        policyReason: "Mutating action requires successful audit persistence.",
        auditLogId: null,
        auditLogError: "insert failed",
      }),
    });

    expect(result.status).toBe("blocked");
    expect(result.message).toContain("audit logging failed");
  });

  it("read commands still execute without token", async () => {
    const context = resolveCopilotContext({
      calls: makeCalls(),
      currentCallId: "call-1",
    });

    const result = await routeCommand({
      commandText: "summarize current job",
      userId: "user-1",
      clientId: "client-1",
      context,
      fetchAllowedActions: async () => allowAllRows(),
      writeExecutionAudit: async () => ({ id: "audit-read-1", error: null }),
    });

    expect(result.status).toBe("success");
    expect(result.intentKey).toBe("summarize_current_job");
  });
});
