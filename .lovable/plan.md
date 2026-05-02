## Goal

Replace the confusing raw AI prompt screen on **Step 6 — Review & Launch** with a friendly, plain-English preview that non-technical users can understand. The raw script stays available, but is hidden behind a collapsible "Show advanced instructions" toggle.

This is a UI-only change to Step 6 in `src/pages/Setup.tsx`. No data, schema, or save logic changes.

## What changes

### `src/pages/Setup.tsx` — Step 6 only

Remove the current Step 6 content (the "Your script is ready to generate" callout + raw `<pre>` block showing `generated`).

Replace with this layout:

**Header**
- Title: "Your AI Receptionist Preview"
- Subtext: "This is how your assistant will answer and handle calls."

**Section 1 — Greeting preview** (highlighted card)
> "Thanks for calling **{state.businessName || 'your business'}**, how can I help you today?"

Uses the dynamic business name from wizard state. If empty, falls back to "your business".

**Section 2 — What it will do** (clean checklist with icons)
"Your assistant will:"
- Greet callers professionally
- Ask a few quick questions
- Capture their details
- Send the lead to you instantly

**Section 3 — Questions it will ask** (clean bulleted list)
- Name
- Phone number
- Service address
- What's going on
- How urgent it is

**Section 4 — Advanced (collapsed by default)**
A `Collapsible` (from `@/components/ui/collapsible`) with trigger label **"Show advanced instructions"** (chevron icon). When opened, reveals the existing `<pre>` block with the raw `generated` prompt. Hidden by default.

**Buttons** (replace the current footer for Step 6)
The wizard's shared footer renders the final-step button as "Generate My AI Receptionist". Update its label to:
- Primary: **"Launch My AI Receptionist"** (keeps existing `generateAndFinish` handler, `submitting` state, and styling)
- Secondary: **"Edit Settings"** — calls `setStep(0)` to jump back to Step 1 (Business Info) so the user can revise

The "Back" button on the left stays as-is for consistency with other steps.

## Technical notes

- Only the `step === 5` JSX block and the footer button label are touched.
- Reuse existing primitives: `Card`-style divs already in the file, `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent`, lucide icons (`Check`, `ChevronDown`, `Sparkles`).
- `generated` (from `generateAssistantPrompt(state)`) stays — it's still saved to `callcapture_assistant_configs.generated_prompt` in `generateAndFinish`. We just stop showing it by default.
- No changes to: `wizardSchema`, `generatePrompt`, save logic, navigation, progress bar, other steps, or the sidebar.
- The "Edit Settings" secondary button is rendered inline within the Step 6 content (not in the shared footer) to avoid affecting button layout on other steps.
