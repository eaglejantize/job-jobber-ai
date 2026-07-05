import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { currentClientId, supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_recent_calls",
  title: "List recent calls",
  description: "List the signed-in account's most recent AI receptionist calls with basic metadata.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many calls to return (max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    const clientId = await currentClientId(ctx);
    if (!clientId) return { content: [{ type: "text", text: "No Vektuor client found for this user." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("callcapture_calls")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { calls: data ?? [] },
    };
  },
});