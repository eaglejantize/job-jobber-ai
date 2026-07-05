import { defineTool } from "@lovable.dev/mcp-js";
import { currentClientId, supabaseForUser } from "./_supabase";

export default defineTool({
  name: "get_business_profile",
  title: "Get business profile",
  description: "Return the signed-in Vektuor account's business profile, hours, AI greeting, tone, and assigned phone number.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    const clientId = await currentClientId(ctx);
    if (!clientId) return { content: [{ type: "text", text: "No Vektuor client found for this user." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("callcapture_clients")
      .select("id, business_name, business_email, business_phone, address, website, industry, tone, greeting, voice_label, assigned_callcapture_number, business_hours_schedule, business_hours_24_7, services, service_area")
      .eq("id", clientId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { profile: data },
    };
  },
});