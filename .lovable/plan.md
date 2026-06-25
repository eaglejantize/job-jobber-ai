## Problem

The admin page already supports permanently deleting a test sub‑account (it calls the `delete-subaccount` edge function, which wipes the client row, related records, and the auth user — so the email can sign up again). But the action is hidden inside a three‑dot icon button (`⋯`) on the **Subscribers** tab only, and not present at all on the **Overview** tab's "Recent signups" table. That's why it feels missing.

## Fix

1. **Add a visible "Delete" button on every subscriber row** (Subscribers tab), next to the existing `⋯` menu, styled red so it's obvious. Clicking it opens the same confirmation dialog that's already wired up.
2. **Add the same actions column to the Overview tab's "Recent signups" table** so a test account can be deleted from there too without switching tabs.
3. **Add a one‑line helper note** above the Subscribers list: "Deleting permanently removes the account, related data, and the login so the email can sign up again."
4. **No backend or schema changes.** The `delete-subaccount` edge function and the super‑admin gate (`eaglejantize@gmail.com`) already do exactly what's needed — already removes the auth user, which is what unblocks re‑signup.

## Files touched

- `src/pages/Admin.tsx` — render an explicit Delete button per row, pass `actions` to the Overview recent‑signups table, add the helper line.

Nothing else changes. After this you'll see a red **Delete** button on each row in `/admin` → Subscribers (and Overview → Recent signups), confirm, and the email is free to onboard again.
