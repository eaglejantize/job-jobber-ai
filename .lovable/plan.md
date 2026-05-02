## Goal

Add a final **success screen** to the onboarding wizard. After the user clicks "Launch My AI Receptionist" on Step 6, save their config and advance them to Step 7 — a celebratory "You're live" screen — instead of immediately redirecting. Auto-redirect to `/dashboard` after 3 seconds.

This must feel like a finish line, not another form step.

## What changes

### `src/pages/Setup.tsx`

**1. Add a 7th step to `STEPS`:**
```ts
const STEPS = [
  "Business Info",
  "Phone Setup",
  "Call Handling",
  "AI Receptionist Setup",
  "Voice & Greeting",
  "Review & Launch",
  "You're Live",
] as const;
```

**2. Change `generateAndFinish` flow:**
- Keep all existing Supabase save logic (business + assistant config inserts, `setup_status: "Live"` update, `clearWizardState`, `localStorage.removeItem(STEP_KEY)`).
- Remove the immediate `navigate("/dashboard")` and the success toast.
- On success, instead call `setStep(6)` to advance to the new success step.
- Keep error toast behavior on failure.

**3. Render Step 7 (`step === 6`) as a success screen** (no form chrome):

Layout:
- Large green check / celebratory icon (`CheckCircle2` from lucide) centered.
- Title: **"Your AI Receptionist is Ready"**
- Subtext: *"You're live. Your assistant is now answering calls."*

**Summary card** — shows:
- Business Name → `state.businessName`
- Phone Number → `state.phoneNumber || state.phone || "—"`
- Call Handling Mode → derived label:
  - If `state.transferEnabled` and AI handles new calls → "Hybrid (AI + Forwarding)"
  - Else if `state.phoneMode === "existing"` and forwarding only → "Forwarding"
  - Else → "AI"

**What happens next** card:
> When someone calls your number:
> - Your AI receptionist answers instantly
> - Captures the customer's info
> - Sends the lead to you
> - You follow up and book the job

**Buttons:**
- Primary: **"Go to Dashboard"** → `navigate("/dashboard")`
- Secondary: **"Call Your Number to Test"** → `<a href={"tel:" + digits-only of phoneNumber}>` (falls back to demo number if no phone configured)

**Auto-redirect:** `useEffect` watching `step === 6` sets a 3s `setTimeout` → `navigate("/dashboard")`. Cleared on unmount or step change.

**4. Hide wizard chrome on Step 7:**
- Hide the top "Step X of Y" header section and progress bar when `step === 6` (or replace with a subtle "Setup complete" line).
- Hide the bottom Back/Continue/Launch footer row when `step === 6` (the success screen has its own buttons).
- Hide the right-hand sidebar ("We set this up for you") when `step === 6` so the success layout is centered and clean.

### Optional polish
- Wrap the success content in a single centered card (`max-w-xl mx-auto`) so it visually breaks from the wizard pattern.
- Use a small countdown hint: *"Redirecting to your dashboard in 3 seconds…"*

## Technical notes

- Only `src/pages/Setup.tsx` is touched. No schema, RLS, route, or backend changes.
- The success step is conditionally rendered; existing steps 1–6 remain untouched.
- `setStep(6)` works because `STEPS.length` is now 7; existing `next()` validation guards (which key off step indexes 0/1/2/4) are unaffected.
- Onboarding is "marked complete" via the existing `setup_status: "Live"` update on `callcapture_clients` plus `clearWizardState()` — both already happen in `generateAndFinish`.
- The auto-redirect timer must be cleaned up to avoid firing after the user manually clicks "Go to Dashboard".
- No changes to `Dashboard.tsx`, `wizardSchema.ts`, `route-guards.tsx`, or any other file.

## Out of scope
- No real Twilio number provisioning.
- No email/SMS confirmation send.
- No analytics events (can be added later).
