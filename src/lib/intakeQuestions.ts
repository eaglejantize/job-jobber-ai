// Compatibility layer over IndustryDefinition workflows.
import {
  legacyIndustryQuestionsMap,
  resolveIndustryQuestions,
  UNIVERSAL_QUESTIONS,
} from "@/lib/industryDefinition";

export { UNIVERSAL_QUESTIONS };

export const INDUSTRY_QUESTIONS: Record<string, string[]> = legacyIndustryQuestionsMap();

export function questionsForIndustry(industry: string | null | undefined): string[] {
  return resolveIndustryQuestions(industry);
}