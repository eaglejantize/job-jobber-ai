# Wire the CallCapture receptionist script into the product

Make this exact receptionist script the source of truth for both the Setup wizard's generated prompt and what visitors see on the homepage. Plus give you copy-paste Vapi setup steps for (904) 892-7004.

## 1. Save the canonical script

Create `src/lib/receptionistScript.ts` exporting:
- `RECEPTIONIST_SYSTEM_PROMPT` — the full script you provided (verbatim), parameterized only with `{businessName}` placeholder.
- `RECEPTIONIST_FLOW` — a structured array used by the homepage section (greeting + the 5 questions: Name, Phone, Address, Issue, Urgency + closing line).
- `RECEPTIONIST_GOALS`, `RECEPTIONIST_TONE`, `RECEPTIONIST_DONTS` — used in the homepage display.

This keeps one source of truth so future copy edits update both places.

## 2. Update the Setup wizard generator

Edit `src/lib/generatePrompt.ts` so `generateAssistantPrompt(state)` returns a prompt built from the new script, with the user's business info merged in. Replaces the current generic prompt structure.

Wizard fields still drive personalization (business name, phone, transfer rules, intake questions, notification settings), but the **flow, tone, do-nots, and closing** come from your script verbatim. The "Information to Collect" section is pre-seeded with your 5 fields (Name, Phone, Address, Issue, Urgency) and any custom intake questions the user adds get appended.

The Setup wizard UI itself (`src/pages/Setup.tsx`) doesn't need changes — it'll automatically generate the new prompt on the final step.

## 3. Add a "What your receptionist actually says" section to the homepage

Insert a new section in `src/pages/Index.tsx` between the existing "Try It Live" section and "Cost of missed calls" stats. It will render:

- **Heading:** "Here's exactly what your receptionist does"
- **Sub:** "Short. Natural. Designed to capture the lead and hang up fast."
- A two-column card layout:
  - **Left card — "The flow"**: numbered list of the 5 questions with the example wording from your script ("Can I get your name?", "What's the best number to reach you?", etc.) plus the opening line and closing line.
  - **Right card — "What it never does"**: the DO NOT list rendered as red-tinted bullets (Over-explain, Sound technical, Mention AI, Try to fully solve problems).
- Footer line: "Average call: under 90 seconds. You get the lead by SMS before they hang up."

Uses existing card / typography styles — no new design system pieces.

## 4. Vapi setup steps (delivered in chat after approval)

I'll give you a copy-paste-ready block containing:
- The exact system prompt (your script with `[Business Name]` placeholder filled in for the demo line)
- Recommended Vapi settings: voice (clear/friendly), model (GPT-5 mini or Gemini 2.5 Flash), max call duration 120s, end-call phrases
- Steps to attach to (904) 892-7004 and forward your business line
- A test-call checklist (greeting fires, all 5 fields collected, ends with the closing line, lead SMS arrives)

This is documentation only — no code changes needed for the demo number itself, since Vapi is configured outside the codebase.

## Technical details

- New file: `src/lib/receptionistScript.ts` (constants only, no logic).
- Edited: `src/lib/generatePrompt.ts` — `generateAssistantPrompt` rewritten to compose from `RECEPTIONIST_SYSTEM_PROMPT` + business state. `VAPI_INSTRUCTIONS` updated to reference the new script structure.
- Edited: `src/pages/Index.tsx` — adds one new `<section>` block; no layout reshuffling of existing sections.
- No DB, no edge functions, no new dependencies.
- Tone rules (no "AI assistant" → "AI receptionist", no "platform"/"system") are preserved.

## Out of scope

- No changes to Vapi itself (you'll paste the script in via their dashboard using the steps I provide).
- No changes to the Setup wizard form fields or step order.
- No changes to pricing, footer, or other marketing sections.
