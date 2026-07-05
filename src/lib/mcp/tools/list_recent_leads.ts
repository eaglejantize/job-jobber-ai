import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { currentClientId, supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_recent_leads",
  title: "List recent leads",
  description: "List the signed-in Vektuor account's most recent captured leads (name, phone, issue, status, created_at).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many leads to return (max 50)."),
    status: z.string().optional().describe("Optional status filter, e.g. 'new', 'booked'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    const clientId = await currentClientId(ctx);
    if (!clientId) return { content: [{ type: "text", text: "No Vektuor client found for this user." }], isError: true };
    const sb = supabaseForUser(ctx);
    let q = sb.from("callcapture_leads")
      .select("id, name, phone, email, issue, summary, status, urgency, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { leads: data ?? [] },
    };
  },
});