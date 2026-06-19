## 1. Inbox: query table directly, drop the edge function

**`src/pages/LeadInbox.tsx`**
- Remove the `supabase.functions.invoke("list-leads")` call entirely.
- Replace with:
  ```ts
  const { data, error } = await supabase
    .from("callcapture_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  ```
- No `client_id` filter — show all rows for debugging.
- On error (including table-missing / RLS-empty), set `leads` to `[]` so the "No leads yet" empty state renders. Toast the error message so we still see it.
- Remove the `clientId` state, the "your client_id" debug line, and the realtime subscription that depends on `clientId` (replace with a no-filter realtime subscription on `callcapture_leads` INSERTs so new leads still stream in).

## 2. Lead card: show every captured column

**`src/components/LeadCard.tsx`**
- Extend the `Lead` type to include all DB columns: `business_id`, `new_or_returning`, `timing`, `referral`, `raw_payload`.
- In the expanded "Details" section, render a complete field list:
  - caller_name (`name`), phone, address, service (`treatment`/`type`), issue, urgency, summary, new_or_returning, timing, referral, status, client_id, business_id, created_at.
  - Full `intake_answers` JSON (pretty-printed in a `<pre>` block, not just key/value grid).
  - Transcript (already shown).
  - `raw_payload` JSON pretty-printed in a `<pre>` block so we can inspect exactly what Vapi sent.
- Keep collapsed summary view as-is.

## Out of scope
- `update-vapi-agent` function and AI Settings — untouched.
- `list-leads` edge function — left in place (just no longer called); not deleted.
- No schema or RLS changes. If RLS blocks the direct read we'll see an empty list + toast and address it in a follow-up.
