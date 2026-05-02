
# Phone System Clarity — Plan

Make Settings → Phone Setup self-explanatory for non-technical users, and surface a Call Setup summary on the Dashboard.

## 1. Settings → Phone Setup tab (`src/pages/Settings.tsx`)

Replace the current bare two-input layout with a clear, sectioned page. All sections live inside the existing "Phone Setup" tab so navigation doesn't change.

**Section A — "How Your Calls Are Handled"** (info card, top of tab)

Plain-language list (no jargon):
- Your phone rings first
- If you don't answer after a few rings, your AI receptionist answers
- It collects the caller's information (name, phone, issue)
- You receive the details instantly by text
- You can call them back or follow up

**Section B — Call Flow Visual**

Horizontal step strip with icons + arrows (lucide: `Phone` → `PhoneIncoming` → `Bot` → `ClipboardList` → `MessageSquare`). On mobile it stacks vertically. Pure presentational, no state.

```text
Customer calls → Your phone rings → AI answers if missed → Info captured → You get notified
```

**Section C — Ring Control**

New select: "How many rings before AI answers?" with options `1 ring`, `2 rings`, `3 rings (recommended)`. Default `3`.
Helper text: "This gives you a chance to answer first. If you miss the call, your AI takes over so you never lose the lead."

Persisted in `callcapture_assistant_configs.call_rules.ringsBeforeAi` (number). No DB migration needed — `call_rules` is jsonb.

**Section D — Settings (toggles + phone)**

- Toggle: "Let AI answer missed calls" (default ON) — stored in `call_rules.aiAnswerMissed`
- Toggle: "Forward calls to my phone" (default ON) — reuses existing `transfer_enabled`
- Input: "Your phone number" — reuses existing `biz.phone`
- Owner alert SMS number — keep existing `alertPhone` field

**Section E — Value Statement**

Highlighted info box (primary/10 background, rounded):
> "You never miss a customer again. If you're busy or can't answer, your AI receptionist steps in and captures everything for you."

**Save button**

Existing `savePhone` extended to also write `call_rules` (merging `ringsBeforeAi` + `aiAnswerMissed` into existing `call_rules` jsonb on `callcapture_assistant_configs`). Keeps `transfer_enabled` write so the toggle persists from this tab too.

## 2. Dashboard "Call Setup" card (`src/pages/Dashboard.tsx`)

Add a new card beneath the existing Status row (above Quick Actions):

- Title: "Call Setup"
- Rows:
  - Phone Number — `businessPhone` (or em dash)
  - Rings before AI: X — from `call_rules.ringsBeforeAi` (default 3)
  - AI Backup: ON / OFF — from `call_rules.aiAnswerMissed` (default ON)
- Button: "Edit Call Settings" → links to `/settings` (Phone Setup tab is default-shown via `?tab=phone` query, or simply `/settings`).

Fetch `call_rules` in the existing `callcapture_assistant_configs` query (already loaded — just add `call_rules` to the select list).

## Out of scope

- Setup wizard, Voice picker, AI tab, Leads, Auth, Stripe, Twilio, Vapi, edge functions
- DB schema (no migrations)
- Actually wiring `ringsBeforeAi` to Twilio/Vapi behavior — UI + persistence only for now (matches prior pattern of static-then-wire).

## Files touched

- `src/pages/Settings.tsx` — rebuild the Phone Setup tab body, extend `savePhone`
- `src/pages/Dashboard.tsx` — new Call Setup card, extend assistant config select
