## Goal
Make the existing "Delete" action on each subaccount in the super admin panel perform a true hard delete — removing the auth user, the tenant/client record, and every linked row across all tables — instead of just deleting the `callcapture_clients` row.

## What's wrong today
In `src/pages/Admin.tsx`, the `hardDelete` handler runs:
```ts
supabase.from("callcapture_clients").delete().eq("id", id)
```
That's a client-side call running as the admin's JWT. It:
- Leaves the `auth.users` row in place (cannot be deleted from the client at all — requires service role).
- Relies on cascade for related rows, which is inconsistent (some tables reference `user_id`, not `client_id`).
- Has no super‑admin authorization check on the server.

Related tables that must also be cleaned:
- `callcapture_leads` (FK `client_id`)
- `callcapture_assistant_configs` (FK `user_id`)
- `callcapture_businesses` (FK `user_id`, also has `email`)
- `callcapture_support_requests` (FK `user_id`, also has `email`)

## Plan

### 1. New edge function: `supabase/functions/delete-subaccount/index.ts`
- Public CORS + OPTIONS preflight.
- Reads the caller's JWT from the `Authorization` header, uses an anon client with that token to call `auth.getUser()`.
- Authorizes only if `user.email === "eaglejantize@gmail.com"` (super admin). Returns 403 otherwise.
- Accepts `{ client_id: string }` (validated with Zod).
- Uses a `SUPABASE_SERVICE_ROLE_KEY` admin client to:
  1. Load the target client row (`id, user_id, email`). 404 if not found.
  2. Delete `callcapture_leads` where `client_id = :id`.
  3. Delete `callcapture_assistant_configs` where `user_id = :user_id` (if user_id present).
  4. Delete `callcapture_businesses` where `user_id = :user_id` OR `lower(email) = lower(:email)`.
  5. Delete `callcapture_support_requests` where `user_id = :user_id` OR `lower(email) = lower(:email)`.
  6. Delete the `callcapture_clients` row.
  7. If `user_id` is set, call `supabase.auth.admin.deleteUser(user_id)`. If null, look up the auth user by email via `auth.admin.listUsers` (paginated) and delete it if found.
- `console.log` each step with the row counts so failures are diagnosable from edge logs.
- Returns `{ ok: true, deleted: { leads, configs, businesses, support, client, auth_user } }`.

### 2. Wire up the admin UI (`src/pages/Admin.tsx`)
- Change `hardDelete(id)` to call `supabase.functions.invoke("delete-subaccount", { body: { client_id: id } })` instead of the direct table delete.
- Keep the existing `AlertDialog` confirmation flow and the existing red "Delete" dropdown item — no UI restructuring required, it already exists per row.
- On success: toast "Subaccount permanently deleted" and call `onChange()` to refresh the list.
- On error: toast the server-returned `error` message.

### 3. No DB migration
RLS, triggers, and table definitions are untouched. All destructive work runs with the service role inside the new edge function, gated by the super-admin email check.

### 4. Verification
After deploy, from the admin panel as `eaglejantize@gmail.com`:
1. Delete a test subaccount.
2. Confirm the row disappears from the Subscribers list (auto‑refresh).
3. Spot‑check via SQL that no rows remain in `callcapture_clients`, `callcapture_leads`, `callcapture_assistant_configs`, `callcapture_businesses`, `callcapture_support_requests` for that id/user/email, and that the `auth.users` row is gone.

## Files
- Create: `supabase/functions/delete-subaccount/index.ts`
- Edit: `src/pages/Admin.tsx` (replace body of `hardDelete`)
