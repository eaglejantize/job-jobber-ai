import type { WizardState } from "@/lib/wizardSchema";
import { buildReceptionistSystemPrompt, RECEPTIONIST_FIELDS } from "@/lib/receptionistScript";

function naturalList(items: string[], conjunction: string): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items[items.length - 1]}`;
}

export function generateAssistantPrompt(s: WizardState): string {
  const baseFields = RECEPTIONIST_FIELDS.map((f) => `- ${f}`).join("\n");
  const customFields = s.intakeQuestions
    .filter(
      (q) =>
        !RECEPTIONIST_FIELDS.some((f) => f.toLowerCase().includes(q.toLowerCase())) &&
        !["caller name", "phone number", "address", "service needed", "urgency"].includes(q.toLowerCase()),
    )
    .map((q) => `- ${q}`)
    .join("\n");
  const fields = customFields ? `${baseFields}\n${customFields}` : baseFields;

  const transfers = s.transferTriggers.length
    ? s.transferTriggers.map((t) => `- ${t}`).join("\n")
    : "- Caller requests a human\n- Emergency";

  const notify =
    s.sendSms && s.sendEmail
      ? "SMS and email"
      : s.sendSms
      ? "SMS"
      : s.sendEmail
      ? "email"
      : "the team";

  const ownerCallbackName = s.ownerName?.trim() || "the team";
  const treatmentsNatural = naturalList((s.primaryTreatments || []).map(t => t.toLowerCase()), "or");
  const daysNatural = naturalList((s.closedDays || []).map(d => d + "s"), "and");

  let basePrompt = buildReceptionistSystemPrompt(s.businessName, s.industry);
  basePrompt = basePrompt
    .replace(/\{\{businessName\}\}/g, s.businessName || "[Business Name]")
    .replace(/\{\{primaryTreatments_natural\}\}/g, treatmentsNatural)
    .replace(/\{\{businessHours\}\}/g, s.businessHours || "[Hours]")
    .replace(/\{\{closedDays_natural\}\}/g, daysNatural)
    .replace(/\{\{callbackTimeline\}\}/g, s.callbackTimeline || "within 24 hours")
    .replace(/\{\{ownerCallbackName\}\}/g, ownerCallbackName)
    .replace(/\{\{timeOfDayGreeting\}\}/g, "today");
  // {{callerName}} is intentionally left unreplaced — the LLM fills it in dynamically during the call

  return `${basePrompt}

---

BUSINESS INFO:
- Business: ${s.businessName || "[Business Name]"}
- Industry: ${s.industry || "[Industry]"}
- Business phone: ${s.phone || "[Phone]"}
- Business email: ${s.email || "[Email]"}
- Service area: ${s.serviceArea || "[Service Area]"}
- Hours: ${s.businessHours || "[Hours]"}

---

RECEPTIONIST IDENTITY:
You are ${s.assistantName || "the receptionist"} answering for ${s.businessName || "this business"}.

GREETING (use this if it sounds natural, otherwise default to "What can I help you with today?"):
"${s.greeting || `Thanks for calling ${s.businessName || "us"}, what can I help you with today?`}"

TONE OVERRIDE: Speak in a ${s.tone?.toLowerCase() || "friendly"} tone. Short sentences. No jargon.

---

FIELDS TO COLLECT (in addition to the standard flow):
${fields}

Ask one question at a time. Confirm spelling for names and addresses.

---

TRANSFERS:
${
  s.transferEnabled
    ? `Transfer the call to ${s.transferPhone || "the owner"} if any of these are true:\n${transfers}`
    : "Transfers are disabled — take a message instead and reassure the caller someone will call back shortly."
}

IF NO ONE PICKS UP THE TRANSFER:
${s.fallbackAction || "Take a complete message"} and reassure the caller that someone will follow up shortly.

---

AFTER HOURS:
${
  s.afterHoursEnabled
    ? "Continue to answer outside business hours. Collect all details and tell the caller someone will follow up the next business day."
    : "Outside business hours, take a message and tell the caller the team will follow up the next business day."
}

---

AFTER EVERY CALL:
Send the lead summary to the owner via ${notify} in this format:

Name:
Phone:
Address:
Service needed:
Issue:
Urgency:
Notes / call summary:

---

ESCALATION:
If the caller is upset, in an emergency, or repeatedly asks for a human, transfer immediately. Never argue. Never make promises about pricing or arrival time you cannot keep.
`;
}

export const VAPI_INSTRUCTIONS = `# Connect Vektuor to Vapi

1. Create a free account at vapi.ai (or sign in).
2. In the dashboard, click **Assistants → New Assistant**.
3. Paste your Vektuor instructions into the **System Prompt** field.
4. Pick a voice (we recommend a clear, friendly voice — e.g. ElevenLabs "Sarah" or "Adam").
5. Set **Max call duration** to 120 seconds. Calls should be short and natural.
6. Set the **First message** to: "What can I help you with today?"
7. Go to **Phone Numbers → Buy or Connect a Number**.
8. Attach your new assistant to the number.
9. Forward your business line to the new number.
10. Make a test call and confirm: greeting fires, all fields are collected, the closing line is read, and the lead arrives by SMS/email.

Don't want to do this yourself? Click **Request Setup Help** and we'll set it up in 24 hours.`;