To go live so ChatGPT / Claude / Cursor can connect to your Vektuor MCP server, two things still need to happen on the backend. Both are one-shot actions — no code changes needed unless something fails.

## Steps

1. **Turn on the OAuth authorization server** (Lovable Cloud)
   - Runs `supabase--configure_oauth_server` with no params.
   - This enables OAuth 2.1 + Dynamic Client Registration on your Supabase Auth so external MCP clients can self-register, send users through consent at `/.lovable/oauth/consent` (already built), and receive user-scoped tokens.
   - Idempotent — safe if it was partially configured before.

2. **Deploy the `mcp` Edge Function**
   - Runs `supabase--deploy_edge_functions` for `mcp`.
   - This pushes the auto-generated `supabase/functions/mcp/index.ts` (with the four tools: `list_recent_leads`, `get_lead`, `list_recent_calls`, `get_business_profile`) to the live endpoint:
     `https://mzqazxtcwqumroqtmtjd.supabase.co/functions/v1/mcp`
   - Must be redeployed any time we add/edit a tool or change auth config.

3. **Verify the manifest**
   - Runs `app_mcp_server--extract_mcp_manifest` to confirm `.lovable/mcp/manifest.json` is current and the server entry has no errors.

4. **Publish the app** (if not already published on this build)
   - So the consent page at `/.lovable/oauth/consent` is reachable at your production origin (`vektuor.com`) for external clients redirecting users through login/consent.

## After activation — how you connect a client

- **In ChatGPT / Claude / Cursor**: add a custom MCP server with URL
  `https://mzqazxtcwqumroqtmtjd.supabase.co/functions/v1/mcp`
- The client will auto-discover OAuth, pop open a Vektuor login + consent screen, and then have access to the four read-only tools scoped to that user's account.
- You can also surface this in-app later (Settings → Integrations panel with a copy-URL button) — say the word if you want that UI added.

## What I'm NOT changing

- No tool code, no schema, no UI changes in this step.
- No new secrets required (Supabase URL + anon key are already wired).

Approve and I'll run steps 1–3 (and 4 if you also want to publish now).