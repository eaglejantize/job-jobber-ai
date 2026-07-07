import { SupabaseClient } from "npm:@supabase/supabase-js@2";

type CopilotExecutionAuditRecord = {
  userId: string;
  clientId: string;
  commandText: string;
  intentKey: string | null;
  actionKey: string | null;
  status: "success" | "blocked" | "error";
  policyReason: string | null;
  resultSummary: string | null;
  contextSnapshot: Record<string, unknown>;
  errorMessage: string | null;
};

export async function writeCopilotExecutionAudit(
  admin: SupabaseClient,
  record: CopilotExecutionAuditRecord,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await admin
    .from("command_execution_log")
    .insert({
      user_id: record.userId,
      client_id: record.clientId,
      command_text: record.commandText,
      intent_key: record.intentKey,
      action_key: record.actionKey,
      status: record.status,
      policy_reason: record.policyReason,
      result_summary: record.resultSummary,
      context_snapshot: record.contextSnapshot,
      error_message: record.errorMessage,
    })
    .select("id")
    .maybeSingle();

  return {
    id: (data as { id?: string } | null)?.id ?? null,
    error: error?.message ?? null,
  };
}
