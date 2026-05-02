## Plan: Lead Inbox page

Add a `/leads` page that lists every captured lead from `callcapture_leads`, newest first. Auth-gated (same pattern as Dashboard). Minimal — no filters, no detail view, no edit.

### 1. Database — add SELECT policy

The `callcapture_leads` table currently has **RLS enabled but zero policies**, so the edge function (service role) can write but no client can read. We need a read policy.

Since leads are not user-scoped (the webhook from Vapi doesn't know which app user owns the call — there's no `user_id` column), the simplest correct rule is: **any authenticated user can read all leads**. This matches the "Lead Inbox for the operator" intent and avoids inventing ownership we don't have.

Migration:
```sql
CREATE POLICY "authenticated can read leads"
ON public.callcapture_leads
FOR SELECT
TO authenticated
USING (true);
```

(If you'd rather restrict to a specific admin later, we can swap this for a `has_role(...)` policy then. Flagging now so you can say no.)

### 2. New page `src/pages/LeadInbox.tsx`

- Use `Layout` + `useAuth` guard, redirect to `/auth` if not signed in (mirrors `Dashboard.tsx`).
- Fetch on mount:
  ```ts
  supabase
    .from("callcapture_leads")
    .select("id, name, phone, issue, urgency, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  ```
- Render with the existing `Table` primitives (`@/components/ui/table`):
  - Columns: **Name**, **Phone**, **Issue**, **Urgency**, **Received**.
  - Urgency rendered as a `Badge` — `destructive` variant when value looks urgent (`true`, `high`, `urgent`, case-insensitive), otherwise `secondary`.
  - `created_at` formatted as a relative time ("3m ago", "2h ago", "Apr 30") via a tiny inline helper — no new dependency.
  - Empty state: "No leads yet. They'll appear here as calls come in."
  - Loading state: simple "Loading…" line, same as Dashboard.
- Mobile: table wrapper already scrolls horizontally (`overflow-auto` in `Table`), so it works on small screens without extra work.

### 3. Routing + nav

- Register the route in `src/App.tsx`:
  ```tsx
  <Route path="/leads" element={<LeadInbox />} />
  ```
  Place above the catch-all.
- Add `{ to: "/leads", label: "Leads" }` to the `links` array in `src/components/SiteNav.tsx` so it shows up in both the desktop and mobile nav.

### Out of scope
- No detail page, no editing/deleting leads, no realtime subscription, no filters/search, no CSV export, no pagination beyond the 200-row cap.
- No changes to `send-demo-sms` or any existing table.

### Files touched
- New migration: SELECT policy on `callcapture_leads`.
- New file: `src/pages/LeadInbox.tsx`.
- Edit: `src/App.tsx` (route).
- Edit: `src/components/SiteNav.tsx` (nav link).

Approve to implement.