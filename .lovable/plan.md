# AI Setup Concierge v1

A guided, conversational setup assistant that interviews the business owner section-by-section and proposes Vektuor configuration. It writes to the **same `callcapture_clients` fields** that the AI Control Center and Sync to Vapi already use — no parallel data model.

## Entry Points

- New prominent **"Launch AI Setup Concierge"** button at the top of `/settings` (next to the Sync to Vapi button in `ControlCenter.tsx`).
- Inline **"Let the Concierge fill this in"** prompts on empty/incomplete sections in Business, AI Receptionist, and Knowledge tabs.
- New route `/settings/concierge` opens the assistant in a focused full-screen layout. State persists so the user can leave and return.

## The 14 Sections

Asked one at a time, each with: pre-filled current value, AI-suggested value (when applicable), edit field, and per-section actions.

1. Business Profile (name, phone, email, address, website)
2. Industry Selection (uses existing `IndustryCombobox`, group + specific)
3. Services Offered
4. Business Hours (visual editor reused from BusinessTab)
5. Service Area
6. Emergency Service Rules
7. Scheduling Preferences (enabled + mode)
8. Service / Diagnostic Fee
9. AI Greeting (`first_message`)
10. After-Hours Message
11. SMS Follow-up Template
12. FAQs
13. Policies
14. **Review & Apply** (before/after diff with per-field apply toggles)

## Behavior Rules

- **Pre-fill** every section from the user's current `callcapture_clients` row.
- **Google Business data**: if `address`/`website` are present, offer a "Use my Google Business data" action that calls the existing `business-lookup` edge function and merges the result into pending answers (user-approved only).
- **Industry-aware suggestions**: each AI generation call includes industry + group + business name so output is tailored.
- **Never overwrite without confirmation** — concierge stages all proposals in local "pending" state; nothing is written to the DB until the user approves in Review.
- **Safety**: AI must not invent hours, prices, licenses, warranties, or emergency policies. Prompts explicitly instruct the model to ask via a `needs_user_input` flag rather than fabricate. Generated content is labeled "Suggested" until approved.

## Per-Section AI Actions

A shared action bar on each step:
- Generate for me
- Improve this
- Make it more professional
- Make it warmer
- Use my industry
- Use my Google Business data (only when address/website exist)

All actions call a single new edge function `concierge-generate` with `{ section, action, context, currentValue }`.

## Review & Apply Screen

Table with rows per field:
- Field label
- Current value (from DB)
- Suggested value (editable)
- Apply toggle (default on for changed rows)

Footer: **Apply Selected**, **Apply All**, **Back to Edit**.

After apply: single `UPDATE callcapture_clients` for the chosen fields, then a success screen with:
- Sync to Vapi (reuses existing `update-vapi-agent` invocation)
- Test Call (links to existing TestCallButton flow)
- Return to AI Control Center

## UX Shell

- Top progress bar (14 steps) + step list sidebar on desktop, collapsed on mobile.
- Buttons: **Back**, **Skip Section**, **Save & Continue Later**, **Exit Without Saving**, **Restart Setup**.
- Save & Continue Later persists `{ pendingAnswers, currentStep }` to a new `concierge_state` JSONB column on `callcapture_clients` (single column, no new tables).
- Restart clears that column.

## Files to Add

```text
src/concierge/
  ConciergePage.tsx          # route shell, progress, nav, persistence
  useConcierge.ts            # state machine: pending answers, step, load/save
  sections.ts                # 14 section definitions (id, label, fields, prompt hints)
  SectionRenderer.tsx        # dispatches to per-section editors
  ActionBar.tsx              # Generate/Improve/Professional/Warmer/Industry/GBP
  ReviewAndApply.tsx         # before/after diff with toggles
  PostApply.tsx              # Sync to Vapi / Test Call / Return
  sections/                  # small editors per section, reusing Business/AI/Knowledge tab inputs
src/pages/Concierge.tsx      # thin Layout wrapper around ConciergePage
supabase/functions/concierge-generate/index.ts
```

## Files to Modify

- `src/App.tsx` — add `/settings/concierge` route.
- `src/settings/ControlCenter.tsx` — add "Launch AI Setup Concierge" button in the header.
- `src/settings/tabs/BusinessTab.tsx`, `AiReceptionistTab.tsx`, `KnowledgeTab.tsx` — small "Let the Concierge handle this" callouts on empty sections (no logic change to existing fields).

## Database

One migration: add `concierge_state JSONB` column to `callcapture_clients` for save-and-resume. No new tables. All applied values land in existing columns already used by `update-vapi-agent`.

## Edge Function: `concierge-generate`

- Auth: verifies caller, loads their `callcapture_clients` row server-side for context (industry, business name, hours, etc.).
- Input: `{ section: SectionId, action: "generate"|"improve"|"professional"|"warmer"|"industry"|"gbp", currentValue, userNotes? }`.
- Uses Lovable AI Gateway with `google/gemini-3-flash-preview`.
- For `gbp`: calls existing `business-lookup` internally if address/website present; otherwise returns `needs_user_input`.
- Returns `{ value, notes?, needs_user_input? }`. For FAQs/services/policies, `value` is a typed array; for messages, a string.
- Output schemas kept small to stay within Gemini constrained-decoding limits (per ai-sdk-agent-patterns guidance).

## Reuse, Not Rebuild

- Hours editor, IndustryCombobox, services/FAQ/policy editors are imported from existing tab components where possible.
- Sync to Vapi reuses `SyncToVapiButton` / `update-vapi-agent`.
- Test Call reuses `TestCallButton`.
- Google Business reuses `business-lookup`.

## Out of Scope (v1)

- No standalone "concierge sessions" table or analytics.
- No multi-user collaboration on a single concierge run.
- No voice-first concierge (text chat-style UI only).
- No automatic background regeneration — every change is user-initiated.
