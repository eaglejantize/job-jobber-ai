import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { currentClientId, supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_lead",
  title: "Get lead",
  description: "Get the full details for a single lead by id, including transcript and intake answers.",
  inputSchema: {
    lead_id: z.string().uuid().describe("The lead's UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    const clientId = await currentClientId(ctx);
    if (!clientId) return { content: [{ type: "text", text: "No Vektuor client found for this user." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("callcapture_leads")
      .select("*")
      .eq("id", lead_id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Lead not found." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { lead: data },
    };
  },
});