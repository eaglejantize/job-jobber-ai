import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRecentLeads from "./tools/list_recent_leads";
import getLead from "./tools/get_lead";
import listRecentCalls from "./tools/list_recent_calls";
import getBusinessProfile from "./tools/get_business_profile";

// Build the Supabase issuer from the project ref (Vite inlines this at build
// time so it stays import-safe — no runtime env read). The `.lovable.cloud`
// proxy is NOT accepted as an OAuth issuer by mcp-js.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "vektuor-mcp",
  title: "Vektuor",
  version: "0.1.0",
  instructions:
    "Tools for the Vektuor AI receptionist. Use `list_recent_leads` and `get_lead` to review captured leads, `list_recent_calls` for call history, and `get_business_profile` for the account's setup (hours, greeting, phone number).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRecentLeads, getLead, listRecentCalls, getBusinessProfile],
});