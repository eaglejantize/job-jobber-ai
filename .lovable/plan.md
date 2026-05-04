## Call Greeting Section (Settings → AI Settings)

Add a new "Call Greeting" block at the top of the AI Settings tab in `src/pages/Settings.tsx`, above the existing receptionist name field. The current single-line "Greeting" input gets replaced by this richer composer (the underlying `cfg.greeting` column still stores the final composed text, so nothing else breaks).

### UI inside AI Settings tab

1. **Section header** — "Call Greeting" + helper text: "The first thing every caller hears. Keep it short and natural."

2. **Greeting style dropdown** (shadcn `Select`):
   - Friendly (Recommended) — `Thanks for calling [Business], how can I help you today?`
   - Professional — `You've reached [Business]. How may I assist you?`
   - Direct — `[Business], how can I help you?`

3. **Toggle: "Include receptionist name"** (default ON)
   - When ON, inserts `, this is [Name]` after the business name in each style.

4. **Toggle: "Let callers know this is an automated assistant"** (default OFF, labeled "Optional — for transparency")
   - When ON, replaces the name segment with `, this is the automated assistant`.
   - When both this and "Include name" are ON, disclosure wins (name is overridden) — only one identity phrase at a time.

5. **Live preview card** — bordered, muted background, quote-styled. Re-renders instantly from the three controls + `biz.business_name` + `cfg.assistant_name`. Falls back to "your business" / "your receptionist" when fields are empty.

6. **"Use this greeting" button** — copies the composed preview text into `cfg.greeting`. Greeting is also auto-synced whenever style/toggles/name/business name change *unless* the user has manually edited the greeting input (tracked via a ref, same pattern as `nameManuallyEditedRef`).

7. The existing free-form Greeting `Input` stays below the preview as "Custom greeting (optional override)" so power users can still type whatever they want.

### Composition logic

```text
buildGreeting(style, includeName, disclosure, business, name):
  business = business || "your business"
  name     = name || "your receptionist"

  identity =
    disclosure ? ", this is the automated assistant"
    : includeName ? `, this is ${name}`
    : ""

  switch (style):
    "friendly":     `Thanks for calling ${business}${identity}. How can I help you today?`
    "professional": `You've reached ${business}${identity}. How may I assist you?`
    "direct":       `${business}${identity}, how can I help you?`
```

### Persistence

All four new fields live inside `callcapture_assistant_configs.notification_settings` (existing jsonb) under a `greeting` namespace — no DB migration needed:

```ts
notification_settings.greeting = {
  greeting_style: "friendly" | "professional" | "direct",
  include_name: boolean,
  disclosure_mode: boolean,
  final_greeting_text: string,  // mirror of cfg.greeting at save time
}
```

`cfg.greeting` continues to hold `final_greeting_text` so the existing `regeneratePrompt` flow keeps working unchanged. `saveAi` is extended to write the nested `greeting` object alongside the existing notification_settings.

### Out of scope

Voice picker, tone, intake questions, phone tab, dashboard, setup wizard, edge functions, Vapi/Twilio/Stripe — all untouched.

### Files touched

- `src/pages/Settings.tsx` — new Call Greeting block, `buildGreeting` helper, extend `saveAi`, load defaults from `notification_settings.greeting`.
