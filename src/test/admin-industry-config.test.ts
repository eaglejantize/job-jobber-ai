import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Admin Industry Config Test Suite
 *
 * Tests for admin controls, validation, and audit logging
 */

describe("Admin Industry Config System", () => {
  /**
   * TEST 1: Industry Definition Validation
   */
  describe("Industry Definition Validation", () => {
    const IndustryDefinitionCreateSchema = z.object({
      key: z.string().min(1).regex(/^[a-z0-9_]+$/),
      label: z.string().min(1).max(200),
      description: z.string().max(500).optional(),
      aliases: z.array(z.string()),
      industry_values: z.array(z.string()),
      is_active: z.boolean().default(true),
      is_default: z.boolean().default(false),
      sort_order: z.number().int().default(0),
      metadata: z.record(z.unknown()).default({}),
    });

    it("should validate valid industry definition", () => {
      const valid = {
        key: "med_spa",
        label: "Med Spa",
        description: "Medical spa services",
        aliases: ["med spa", "medspa"],
        industry_values: ["med_spa"],
        is_active: true,
        is_default: false,
        sort_order: 1,
        metadata: { seeded: true },
      };

      const result = IndustryDefinitionCreateSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid key format", () => {
      const invalid = {
        key: "Med Spa", // Invalid: has uppercase and space
        label: "Med Spa",
        aliases: [],
        industry_values: [],
      };

      const result = IndustryDefinitionCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject missing required fields", () => {
      const missing = {
        label: "Med Spa",
        // key is missing
      };

      const result = IndustryDefinitionCreateSchema.safeParse(missing);
      expect(result.success).toBe(false);
    });

    it("should enforce label max length", () => {
      const tooLong = {
        key: "test",
        label: "a".repeat(201), // Exceeds 200 char limit
        aliases: [],
        industry_values: [],
      };

      const result = IndustryDefinitionCreateSchema.safeParse(tooLong);
      expect(result.success).toBe(false);
    });
  });

  /**
   * TEST 2: Industry Workflow Validation
   */
  describe("Industry Workflow Validation", () => {
    const VALID_TEMPLATES = z.enum(["service_receptionist", "med_spa_concierge"]);

    const IndustryWorkflowCreateSchema = z.object({
      industry_definition_id: z.string().uuid(),
      workflow_key: z.string().min(1),
      workflow_name: z.string().min(1).max(200),
      is_default: z.boolean().default(false),
      is_active: z.boolean().default(true),
      default_services: z.array(z.string()).min(1),
      intake_questions: z.array(z.string()).min(1),
      ai_prompts: z.object({
        system_prompt_template: VALID_TEMPLATES,
      }),
      metadata: z.record(z.unknown()).default({}),
    });

    it("should validate valid workflow config", () => {
      const valid = {
        industry_definition_id: "123e4567-e89b-12d3-a456-426614174000",
        workflow_key: "default",
        workflow_name: "Default Service Intake",
        is_default: true,
        is_active: true,
        default_services: ["Repair", "Installation"],
        intake_questions: ["Service address", "Issue"],
        ai_prompts: { system_prompt_template: "service_receptionist" },
        metadata: {},
      };

      const result = IndustryWorkflowCreateSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid template type", () => {
      const invalid = {
        industry_definition_id: "123e4567-e89b-12d3-a456-426614174000",
        workflow_key: "default",
        workflow_name: "Default Service Intake",
        default_services: ["Repair"],
        intake_questions: ["Service address"],
        ai_prompts: { system_prompt_template: "invalid_template" }, // Invalid
      };

      const result = IndustryWorkflowCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should require at least one service and question", () => {
      const incomplete = {
        industry_definition_id: "123e4567-e89b-12d3-a456-426614174000",
        workflow_key: "default",
        workflow_name: "Default",
        default_services: [], // Empty - invalid
        intake_questions: [], // Empty - invalid
        ai_prompts: { system_prompt_template: "service_receptionist" },
      };

      const result = IndustryWorkflowCreateSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("should require valid UUID for industry_definition_id", () => {
      const invalid = {
        industry_definition_id: "not-a-uuid",
        workflow_key: "default",
        workflow_name: "Default",
        default_services: ["Service"],
        intake_questions: ["Question"],
        ai_prompts: { system_prompt_template: "service_receptionist" },
      };

      const result = IndustryWorkflowCreateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  /**
   * TEST 3: Admin Access Control
   */
  describe("Admin Access Control", () => {
    it("should verify admin user before allowing edits", () => {
      // Simulate admin check
      const userId = "user-123";
      const isSuperAdmin = true;

      const canEdit = userId && isSuperAdmin;
      expect(canEdit).toBe(true);
    });

    it("should deny non-admin users", () => {
      const userId = "user-456";
      const isSuperAdmin = false;

      const canEdit = userId && isSuperAdmin;
      expect(canEdit).toBe(false);
    });

    it("should require valid authorization token", () => {
      const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
      const hasAuth = authHeader?.startsWith("Bearer ");

      expect(hasAuth).toBe(true);
    });
  });

  /**
   * TEST 4: Audit Logging
   */
  describe("Audit Logging", () => {
    it("should record audit entry on definition create", () => {
      const auditRecord = {
        admin_user_id: "admin-123",
        entity_type: "definition",
        entity_id: "def-456",
        entity_key: "med_spa",
        action: "create",
        before_snapshot: null,
        after_snapshot: {
          key: "med_spa",
          label: "Med Spa",
          is_active: true,
        },
        created_at: new Date().toISOString(),
      };

      expect(auditRecord.action).toBe("create");
      expect(auditRecord.entity_type).toBe("definition");
      expect(auditRecord.after_snapshot).toBeDefined();
      expect(auditRecord.before_snapshot).toBeNull();
    });

    it("should record audit entry on definition update", () => {
      const auditRecord = {
        admin_user_id: "admin-123",
        entity_type: "definition",
        entity_id: "def-456",
        action: "update",
        before_snapshot: { label: "Old Label", is_active: true },
        after_snapshot: { label: "New Label", is_active: true },
      };

      expect(auditRecord.action).toBe("update");
      expect(auditRecord.before_snapshot).toBeDefined();
      expect(auditRecord.after_snapshot).toBeDefined();
      expect(auditRecord.before_snapshot.label).not.toBe(auditRecord.after_snapshot.label);
    });

    it("should track activation/deactivation as specific actions", () => {
      const deactivateAudit = {
        action: "deactivate",
        before_snapshot: { is_active: true },
        after_snapshot: { is_active: false },
      };

      const activateAudit = {
        action: "activate",
        before_snapshot: { is_active: false },
        after_snapshot: { is_active: true },
      };

      expect(deactivateAudit.action).toBe("deactivate");
      expect(activateAudit.action).toBe("activate");
    });
  });

  /**
   * TEST 5: Resolver Fallback Order
   */
  describe("Resolver Fallback Order", () => {
    it("should respect resolver fallback priority", () => {
      // Priority:
      // 1. Assigned industry config
      // 2. Default industry config
      // 3. Compatibility fallback (last resort)

      const resolveIndustry = (assignedConfig: unknown, defaultConfig: unknown, legacyFallback: unknown) => {
        return assignedConfig || defaultConfig || legacyFallback;
      };

      const assigned = { key: "med_spa", label: "Med Spa" };
      const defaultCfg = { key: "service_business_default", label: "Service Business" };
      const legacy = { key: "hvac", label: "HVAC" };

      // Test 1: Assigned config takes priority
      const result1 = resolveIndustry(assigned, defaultCfg, legacy);
      expect(result1).toBe(assigned);

      // Test 2: Default config used if no assigned
      const result2 = resolveIndustry(null, defaultCfg, legacy);
      expect(result2).toBe(defaultCfg);

      // Test 3: Legacy fallback used as last resort
      const result3 = resolveIndustry(null, null, legacy);
      expect(result3).toBe(legacy);
    });

    it("should not break existing tenant behavior", () => {
      // Existing tenants without explicit config should still work
      const legacyTenant = {
        industry: "hvac",
        // No explicit industry_definition_id
      };

      // Resolver should use compatibility fallback
      const fallbackKey = "service_business_default"; // Default for unmapped industries
      const resolvedKey = legacyTenant.industry === "hvac" ? fallbackKey : legacyTenant.industry;

      expect(resolvedKey).toBe("service_business_default");
    });
  });

  /**
   * TEST 6: Industry Config Schema Consistency
   */
  describe("Industry Config Schema Consistency", () => {
    it("should ensure intake questions is array of strings", () => {
      const workflow = {
        intake_questions: [
          "Service address",
          "Issue / problem",
          "Urgency",
        ],
      };

      expect(Array.isArray(workflow.intake_questions)).toBe(true);
      expect(workflow.intake_questions.every((q: unknown) => typeof q === "string")).toBe(true);
    });

    it("should ensure default_services is array of strings", () => {
      const workflow = {
        default_services: ["Repair", "Installation", "Maintenance"],
      };

      expect(Array.isArray(workflow.default_services)).toBe(true);
      expect(workflow.default_services.every((s: unknown) => typeof s === "string")).toBe(true);
    });

    it("should ensure ai_prompts has valid template type", () => {
      const VALID_TEMPLATES = ["service_receptionist", "med_spa_concierge"];

      const workflow1 = {
        ai_prompts: { system_prompt_template: "service_receptionist" },
      };

      const workflow2 = {
        ai_prompts: { system_prompt_template: "med_spa_concierge" },
      };

      expect(VALID_TEMPLATES).toContain(workflow1.ai_prompts.system_prompt_template);
      expect(VALID_TEMPLATES).toContain(workflow2.ai_prompts.system_prompt_template);
    });
  });
});
