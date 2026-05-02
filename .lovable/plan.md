## Goal

The wizard already has 6 steps in the requested order:

1. Business Info
2. Phone Setup
3. Call Handling
4. AI Receptionist Setup
5. Voice & Greeting
6. Review & Launch

Today, Step 2 ("Phone Setup") is just two plain inputs (business phone + owner SMS). I'll rebuild **Step 2** into the full structured experience you described, without touching the other steps, navigation, or save logic.

## Changes

### 1. `src/lib/wizardSchema.ts`
Add two persisted fields so progress survives reloads:
- `phoneMode: "new" | "existing" | "test"` (default `"new"`)
- `phoneNumber: string` (default `""`) — holds the generated mock number or the user-entered existing number; mirrored into the existing `phone` field so downstream code (Setup save, Settings, Dashboard "Business phone") keeps working unchanged.

Defaults stay backward-compatible — old `localStorage` payloads continue to load via the existing spread merge.

### 2. `src/pages/Setup.tsx` — rewrite Step 2 only

New Step 2 UI:

**Header**
- Title: "Set Up Your Business Phone"
- Subtext: "This is the number your customers will call."

**Section 1 — Choose phone type** (shadcn `RadioGroup`)
- Get a new business number (recommended)
- Use my existing number (forward calls)
- Skip for now (test mode)

**Section 2 — Dynamic inputs** (driven by `phoneMode`)

- `new`: Area Code input (3 digits) + "Generate Number" button. Generates a mock number `(<area>) XXX-XXXX` with random digits, stores in `phoneNumber`, and shows the result in a highlighted card with a "Regenerate" link.
- `existing`: Phone input + helper "You'll forward this number to your AI assistant."
- `test`: Info card "You can test the system without a real number." Auto-sets `phoneNumber` to empty and bypasses the phone validation in `next()`.

Owner alert SMS field stays on this step (it's not on any other step and is needed for lead alerts).

**Section 3 — How it works** (static info card)
> When someone calls your number:
> - Your AI receptionist answers instantly
> - Captures customer details
> - Sends the lead to you
> - Optionally forwards the call

**Validation update in `next()` for step 2:**
- `new`: require a generated `phoneNumber`
- `existing`: require non-empty `phoneNumber`
- `test`: no requirement
- Keep `phone` in sync with `phoneNumber` so the rest of the flow (Setup submit → `callcapture_businesses.phone`, Dashboard, Settings) is unaffected.

### 3. No changes elsewhere
- Step order, progress bar, Continue/Back, persistence (`callcapture.wizard.step`), and the save-to-Supabase logic in `generateAndFinish` remain untouched.
- No DB migration. `phone_mode` is stored only in local wizard state (and inside `call_rules` JSON if useful later); we explicitly keep Twilio out of scope per your note.
- No impact on Stripe, Vapi, Twilio, SMS, lead capture, auth, or routing.

## Technical notes

- Use existing `Radio` primitives via `@/components/ui/radio-group`.
- Mock number generator: `const n = () => Math.floor(1000 + Math.random()*9000); const m = () => Math.floor(100 + Math.random()*900); setPhoneNumber(\`(\${area}) \${m()}-\${n()}\`)`.
- Area code input: numeric, maxLength 3; "Generate" disabled until 3 digits.
- When user switches `phoneMode`, clear `phoneNumber` to avoid stale values.
