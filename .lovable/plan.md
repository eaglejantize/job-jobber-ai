## Goal
Give super-admins an easy way to navigate from `/admin` back to the user dashboard at `/dashboard`.

## Change
In `src/pages/Admin.tsx`, add a "Back to Dashboard" link in the sidebar footer, directly above the "Sign out" button.

- Use `react-router-dom`'s `Link` with `to="/dashboard"`.
- Use the existing `ArrowLeft` icon from `lucide-react` (added to the import list).
- Match the existing button styling in that footer area (same `bg-slate-900 hover:bg-slate-700` treatment) so it visually pairs with Sign out.

No other files, routes, or business logic change.
