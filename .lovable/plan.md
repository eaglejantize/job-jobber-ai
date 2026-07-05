## Publish + verify MCP server end-to-end

### 1. Pre-publish security check
- `security--get_scan_results` — confirm no critical findings block publish. If stale/missing, run `security--run_security_scan` and wait.

### 2. Publish
- `preview_ui--publish` — schedules the deploy to `vektuor.com` / `job-jobber-ai.lovable.app`. Wait ~60s for propagation.

### 3. Verify OAuth consent page on production
- `curl` (via `code--exec`) https://vektuor.com/.lovable/oauth/consent?authorization_id=debug
- Expect 200 + the React shell (SPA). A blank/404 means the route isn't registered on the production build.

### 4. Verify MCP endpoint reachability
- `supabase--curl_edge_functions` GET `/mcp/.well-known/oauth-protected-resource` → should return JSON with `authorization_servers` pointing at `https://mzqazxtcwqumroqtmtjd.supabase.co/auth/v1`.
- POST `/mcp` with an unauthenticated JSON-RPC `initialize` → expect 401 with `WWW-Authenticate: Bearer` (proves auth is enforced).
- POST `/mcp` with an authenticated `tools/list` (using preview session token auto-injected by the tool) → expect the four tools listed.

### 5. Verify OAuth discovery
- `curl` https://mzqazxtcwqumroqtmtjd.supabase.co/auth/v1/.well-known/oauth-authorization-server → confirm `registration_endpoint` is present (DCR enabled) and `issuer` matches what mcp-js validates against.

### 6. Verify tenant-scoped data via RLS
- `supabase--curl_edge_functions` POST `/mcp` `tools/call` for `list_recent_leads` with preview session → results should be scoped to the signed-in preview user's `client_id`. Confirm row count is plausible (0 for a fresh account is a pass; leaking another tenant's rows is a fail).
- Same for `get_business_profile` — should return the preview user's profile only.
- RLS is enforced by the `owns_client()` security-definer function + policies on `callcapture_clients` / `callcapture_leads` / `callcapture_calls`, plus every tool filters by `currentClientId(ctx)` derived from the OAuth token's `sub`. Verification just proves those layers are wired correctly.

### 7. Verify ChatGPT/Claude end-to-end login+consent
- **Not automatable from the sandbox** — completing a real OAuth handshake requires ChatGPT's or Claude's MCP client, an interactive browser, and a real Supabase user credential. Playwright can't sign the user in to a third-party AI product.
- Instead: report the exact MCP URL to paste, the discovery URLs that prove the handshake will work, and one manual step for you (add the server in ChatGPT/Claude → click through Vektuor consent → confirm the four tools appear).

### Report format
For each check above: ✅/❌, one-line evidence (HTTP status, JSON snippet), and the fix if it fails.

### What I'm NOT doing
- No code changes.
- No changes to publish visibility (leave whatever is currently set).
- No fake automated "ChatGPT logged in successfully" claim — that step is manual.

Approve to run.