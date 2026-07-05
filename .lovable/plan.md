# AI Integrations (MCP) Settings Section

Add a new "AI Integrations" tab to the Settings Control Center so users can connect Vektuor to ChatGPT, Claude, and Cursor via the live MCP server. Read-only, informational — no changes to the MCP server or its tools.

## Where it lives

- New tab in `src/settings/tabs/registry.ts` alongside Business, AI Receptionist, Knowledge, Integrations, etc.
  - `id: "ai-integrations"`, `label: "AI Integrations"`, icon `Sparkles` (or `Plug2`) from lucide.
- New component: `src/settings/tabs/AiIntegrationsTab.tsx`.
- Reachable from the existing `/settings` page (`ConciergePage` / Control Center tab bar) — no route changes.

## Page contents (in order)

1. **Header + intro**
   - Title: "AI Integrations"
   - Subtitle: "Connect Vektuor to AI tools so you can ask questions about your leads, calls, and business profile."

2. **MCP server URL card**
   - Label: "MCP Server URL"
   - Read-only `Input` prefilled with `https://mzqazxtcwqumroqtmtjd.supabase.co/functions/v1/mcp` (built at runtime from `VITE_SUPABASE_PROJECT_ID` so it survives env changes).
   - "Copy MCP URL" button using `navigator.clipboard.writeText` + toast confirmation.

3. **Available tools (read-only)**
   - Badge: "Read-only" (secondary badge, plus a short sentence: "These tools can view your data but cannot make changes.").
   - List of 4 tools with one-line descriptions:
     - `list_recent_leads` — Recent captured leads
     - `get_lead` — Full details for a single lead
     - `list_recent_calls` — Recent AI receptionist calls
     - `get_business_profile` — Business profile, hours, greeting, phone
   - Note: "Write and action tools are not available yet."

4. **Setup instructions** (three collapsible cards, one per client; use existing `Accordion` component)
   - **ChatGPT**
     1. Open `https://chatgpt.com/#settings/Connectors/Advanced` and enable Developer mode.
     2. In the composer's "+" menu, turn on Developer mode.
     3. Click "Add sources" → "Connect more".
     4. Name the connector "Vektuor" and paste the MCP URL above.
     5. Sign in with your Vektuor account and approve access when prompted.
   - **Claude**
     1. Open `https://claude.ai/customize/connectors?modal=add-custom-connector`.
     2. Name the connector "Vektuor" and paste the MCP URL.
     3. Enable the connector from the composer, then sign in and approve access.
   - **Cursor**
     1. Open Cursor Settings → MCP → "Add new MCP server".
     2. Choose HTTP transport, name it "Vektuor", paste the MCP URL.
     3. Save; Cursor will open your browser to sign in and approve.

5. **Auth flow explainer**
   - Short paragraph: "When you connect an AI client, you'll be redirected to Vektuor to sign in and approve the connection. The client never sees your password — it receives a scoped access token issued after you approve."

6. **Security note**
   - Alert (info variant): "Access is scoped to your signed-in Vektuor account and protected by Supabase Row-Level Security. AI clients can only see data that belongs to your account."

7. **Trust warning**
   - Alert (warning variant, amber): "Only connect AI clients you trust. A connected client can read all leads, calls, and business profile data on your behalf until you disconnect it from that client."

## Technical details

- Component uses existing shadcn primitives: `Card`, `Input`, `Button`, `Badge`, `Accordion`, `Alert`, `Separator`.
- All colors via semantic tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-secondary`) — no hardcoded colors.
- Copy button uses the existing `useToast` hook (`@/hooks/use-toast`).
- No new dependencies, no new routes, no backend changes, no MCP manifest changes, no edge function redeploy.
- Tab registered in `TABS` array in `src/settings/tabs/registry.ts`.

## Out of scope

- No changes to `src/lib/mcp/**`, `supabase/functions/mcp/index.ts`, or `.lovable/mcp/manifest.json`.
- No new tools, no write/action tools.
- No standalone `/connect` route — the section lives inside Settings as requested.
- No changes to auth, OAuth consent page, or Supabase config.
