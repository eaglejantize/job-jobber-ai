import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Violation = {
  file: string;
  line: number;
  pattern: string;
  excerpt: string;
};

const ROOT = process.cwd();
const CORE_ROOTS = [
  path.join(ROOT, "src/lib"),
  path.join(ROOT, "supabase/functions"),
];

const ALLOWED_FILES = new Set([
  path.join(ROOT, "src/lib/industryDefinition.ts"),
  path.join(ROOT, "supabase/functions/_shared/industry-definition.ts"),
]);

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);
const SKIP_FILE_SUBSTRINGS = [
  `${path.sep}supabase${path.sep}migrations${path.sep}`,
  `${path.sep}supabase${path.sep}functions${path.sep}_shared${path.sep}transactional-email-templates${path.sep}`,
  `${path.sep}src${path.sep}test${path.sep}`,
];

const DIRECT_BRANCH_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: "direct industry equality branch",
    regex: /\bindustry\s*===\s*["'`](med_spa|hvac|plumbing|electrical|appliance_repair|law_firm)["'`]/i,
  },
  {
    name: "direct industry inequality branch",
    regex: /\bindustry\s*!==\s*["'`](med_spa|hvac|plumbing|electrical|appliance_repair|law_firm)["'`]/i,
  },
  {
    name: "direct industry switch case",
    regex: /\bcase\s+["'`](med_spa|hvac|plumbing|electrical|appliance_repair|law_firm)["'`]\s*:/i,
  },
  {
    name: "direct string-contains branch",
    regex: /\.includes\(\s*["'`](med\s*spa|med-spa|medspa|hvac|plumbing|electrical|appliance|law\s*firm)["'`]\s*\)/i,
  },
];

function listFilesRecursively(startDir: string): string[] {
  if (!fs.existsSync(startDir)) return [];
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(fullPath));
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    files.push(fullPath);
  }

  return files;
}

function shouldSkipFile(filePath: string): boolean {
  if (ALLOWED_FILES.has(filePath)) return true;
  return SKIP_FILE_SUBSTRINGS.some((segment) => filePath.includes(segment));
}

function collectViolations(): Violation[] {
  const violations: Violation[] = [];
  const files = CORE_ROOTS.flatMap((root) => listFilesRecursively(root));

  for (const file of files) {
    if (shouldSkipFile(file)) continue;

    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const pattern of DIRECT_BRANCH_PATTERNS) {
        if (!pattern.regex.test(line)) continue;
        violations.push({
          file: path.relative(ROOT, file),
          line: i + 1,
          pattern: pattern.name,
          excerpt: line.trim(),
        });
      }
    }
  }

  return violations;
}

describe("industry hardcode guard", () => {
  it("blocks direct single-industry branching in core modules", () => {
    const violations = collectViolations();

    const details = violations
      .map((violation) => `${violation.file}:${violation.line} [${violation.pattern}] ${violation.excerpt}`)
      .join("\n");

    expect(
      violations,
      details || "No direct single-industry branching detected in core modules.",
    ).toEqual([]);
  });
});
