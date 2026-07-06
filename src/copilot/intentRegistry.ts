import type { CopilotIntentDefinition } from "@/copilot/types";

// PR1 keeps routing text-first and local by design.
// TODO(phase-2): Load intents/actions from DB with an in-memory cache + TTL.
const INTENT_DEFINITIONS: CopilotIntentDefinition[] = [
  {
    intentKey: "navigate_to_next_work_order",
    actionKey: "navigate_to_next_work_order",
    executionKind: "read",
    description: "Navigate to the next work order in queue.",
    examples: ["next work order", "go to next job", "advance"],
    requiredContext: ["calls"],
    matchers: [
      /\bnext\b/i,
      /\bnext\s+(job|work\s*order|ticket|call)\b/i,
      /\b(go|move|advance)\s+to\s+next\b/i,
    ],
  },
  {
    intentKey: "summarize_current_job",
    actionKey: "summarize_current_job",
    executionKind: "read",
    description: "Summarize the currently selected job.",
    examples: ["summarize current job", "job summary", "recap this call"],
    requiredContext: ["currentCall"],
    matchers: [
      /\bsummar(y|ize)\b/i,
      /\brecap\b/i,
      /\b(current|this)\s+(job|work\s*order|call)\b/i,
    ],
  },
  {
    intentKey: "draft_on_the_way_sms",
    actionKey: "draft_on_the_way_sms",
    executionKind: "read",
    description: "Draft an on-the-way SMS for the current job.",
    examples: ["draft on the way sms", "prepare arrival text", "draft eta message"],
    requiredContext: ["currentCall"],
    matchers: [
      /\bdraft\b/i,
      /\bon\s*the\s*way\b/i,
      /\b(arrival|eta)\s+(sms|text|message)\b/i,
    ],
  },
  {
    intentKey: "add_job_note",
    actionKey: "add_job_note",
    executionKind: "mutate",
    description: "Add a job note to the current work order.",
    examples: ["add job note customer has gate code", "note: bring ladder"],
    requiredContext: ["currentCall"],
    matchers: [
      /\badd\s+(a\s+)?job\s+note\b/i,
      /\badd\s+note\b/i,
      /\bnote\s*[:-]/i,
    ],
  },
];

export function getIntentRegistry(): CopilotIntentDefinition[] {
  return INTENT_DEFINITIONS;
}

export function resolveIntentFromText(commandText: string): CopilotIntentDefinition | null {
  const normalized = commandText.trim();
  if (!normalized) return null;

  let bestMatch: CopilotIntentDefinition | null = null;
  let bestScore = -1;

  for (const definition of INTENT_DEFINITIONS) {
    const score = definition.matchers.reduce((acc, matcher) => acc + (matcher.test(normalized) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = definition;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}
