import { createClient } from "npm:@supabase/supabase-js@^2.105.1";
import { z } from "npm:zod@^3.25.76";
import {
  IndustryDefinitionCreateSchema,
  IndustryDefinitionUpdateSchema,
  IndustryWorkflowCreateSchema,
  IndustryWorkflowUpdateSchema,
} from "../_shared/industry-definition.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// HELPERS
// ============================================================================

async function requireAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("callcapture_clients")
    .select("is_super_admin")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.is_super_admin === true;
}

async function recordAuditLog(
  userId: string,
  entityType: "definition" | "workflow",
  entityId: string,
  entityKey: string | null,
  action: "create" | "update" | "activate" | "deactivate" | "delete",
  beforeSnapshot: unknown,
  afterSnapshot: unknown,
  validationErrors?: string[]
) {
  await supabase.from("callcapture_industry_admin_audit").insert({
    admin_user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    entity_key: entityKey,
    action,
    before_snapshot: beforeSnapshot as never,
    after_snapshot: afterSnapshot as never,
    validation_errors: validationErrors ?? [],
  });
}

// ============================================================================
// HANDLERS
// ============================================================================

async function listDefinitions() {
  const { data, error } = await supabase
    .from("callcapture_industry_definitions")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw new Error(`Failed to list definitions: ${error.message}`);
  return { ok: true, data: data ?? [] };
}

async function getDefinition(id: string) {
  const { data, error } = await supabase
    .from("callcapture_industry_definitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get definition: ${error.message}`);
  if (!data) throw new Error("Definition not found");
  return { ok: true, data };
}

async function createDefinition(userId: string, payload: unknown) {
  const validated = IndustryDefinitionCreateSchema.parse(payload);

  // Check for duplicate key
  const { data: existing } = await supabase
    .from("callcapture_industry_definitions")
    .select("id")
    .eq("key", validated.key)
    .maybeSingle();

  if (existing) {
    throw new Error(`Industry definition with key '${validated.key}' already exists`);
  }

  const { data, error } = await supabase
    .from("callcapture_industry_definitions")
    .insert({
      key: validated.key,
      label: validated.label,
      aliases: validated.aliases,
      industry_values: validated.industry_values,
      description: validated.description,
      is_active: validated.is_active,
      is_default: validated.is_default,
      sort_order: validated.sort_order,
      metadata: validated.metadata,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create definition: ${error.message}`);

  await recordAuditLog(userId, "definition", data.id, data.key, "create", null, data);

  return { ok: true, data };
}

async function updateDefinition(userId: string, id: string, payload: unknown) {
  const before = await getDefinition(id);
  const validated = IndustryDefinitionUpdateSchema.parse(payload);

  const { data, error } = await supabase
    .from("callcapture_industry_definitions")
    .update({
      ...(validated.key !== undefined && { key: validated.key }),
      ...(validated.label !== undefined && { label: validated.label }),
      ...(validated.aliases !== undefined && { aliases: validated.aliases }),
      ...(validated.industry_values !== undefined && { industry_values: validated.industry_values }),
      ...(validated.description !== undefined && { description: validated.description }),
      ...(validated.is_active !== undefined && { is_active: validated.is_active }),
      ...(validated.is_default !== undefined && { is_default: validated.is_default }),
      ...(validated.sort_order !== undefined && { sort_order: validated.sort_order }),
      ...(validated.metadata !== undefined && { metadata: validated.metadata }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update definition: ${error.message}`);

  const action = validated.is_active === false ? "deactivate" : validated.is_active === true ? "activate" : "update";
  await recordAuditLog(userId, "definition", id, data.key, action, before.data, data);

  return { ok: true, data };
}

async function listWorkflows(definitionId: string) {
  const { data, error } = await supabase
    .from("callcapture_industry_workflows")
    .select("*")
    .eq("industry_definition_id", definitionId)
    .order("is_default", { ascending: false })
    .order("workflow_name", { ascending: true });

  if (error) throw new Error(`Failed to list workflows: ${error.message}`);
  return { ok: true, data: data ?? [] };
}

async function getWorkflow(definitionId: string, workflowKey: string) {
  const { data, error } = await supabase
    .from("callcapture_industry_workflows")
    .select("*")
    .eq("industry_definition_id", definitionId)
    .eq("workflow_key", workflowKey)
    .maybeSingle();

  if (error) throw new Error(`Failed to get workflow: ${error.message}`);
  if (!data) throw new Error("Workflow not found");
  return { ok: true, data };
}

async function createWorkflow(userId: string, payload: unknown) {
  const validated = IndustryWorkflowCreateSchema.parse(payload);

  // Check for duplicate workflow_key in definition
  const { data: existing } = await supabase
    .from("callcapture_industry_workflows")
    .select("id")
    .eq("industry_definition_id", validated.industry_definition_id)
    .eq("workflow_key", validated.workflow_key)
    .maybeSingle();

  if (existing) {
    throw new Error(
      `Workflow with key '${validated.workflow_key}' already exists for this definition`
    );
  }

  const { data, error } = await supabase
    .from("callcapture_industry_workflows")
    .insert({
      industry_definition_id: validated.industry_definition_id,
      workflow_key: validated.workflow_key,
      workflow_name: validated.workflow_name,
      is_default: validated.is_default,
      is_active: validated.is_active,
      default_services: validated.default_services,
      intake_questions: validated.intake_questions,
      ai_prompts: validated.ai_prompts,
      terminology: validated.terminology,
      workflows: validated.workflows,
      templates: validated.templates,
      knowledge_base: validated.knowledge_base,
      automations: validated.automations,
      metadata: validated.metadata,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create workflow: ${error.message}`);

  await recordAuditLog(userId, "workflow", data.id, data.workflow_key, "create", null, data);

  return { ok: true, data };
}

async function updateWorkflow(userId: string, definitionId: string, workflowKey: string, payload: unknown) {
  const before = await getWorkflow(definitionId, workflowKey);
  const validated = IndustryWorkflowUpdateSchema.parse(payload);

  const { data, error } = await supabase
    .from("callcapture_industry_workflows")
    .update({
      ...(validated.workflow_name !== undefined && { workflow_name: validated.workflow_name }),
      ...(validated.is_default !== undefined && { is_default: validated.is_default }),
      ...(validated.is_active !== undefined && { is_active: validated.is_active }),
      ...(validated.default_services !== undefined && { default_services: validated.default_services }),
      ...(validated.intake_questions !== undefined && { intake_questions: validated.intake_questions }),
      ...(validated.ai_prompts !== undefined && { ai_prompts: validated.ai_prompts }),
      ...(validated.terminology !== undefined && { terminology: validated.terminology }),
      ...(validated.workflows !== undefined && { workflows: validated.workflows }),
      ...(validated.templates !== undefined && { templates: validated.templates }),
      ...(validated.knowledge_base !== undefined && { knowledge_base: validated.knowledge_base }),
      ...(validated.automations !== undefined && { automations: validated.automations }),
      ...(validated.metadata !== undefined && { metadata: validated.metadata }),
      updated_at: new Date().toISOString(),
    })
    .eq("industry_definition_id", definitionId)
    .eq("workflow_key", workflowKey)
    .select()
    .single();

  if (error) throw new Error(`Failed to update workflow: ${error.message}`);

  const action = validated.is_active === false ? "deactivate" : validated.is_active === true ? "activate" : "update";
  await recordAuditLog(userId, "workflow", data.id, data.workflow_key, action, before.data, data);

  return { ok: true, data };
}

async function getAuditLog(limit: number = 50, offset: number = 0) {
  const { data, error } = await supabase
    .from("callcapture_industry_admin_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to get audit log: ${error.message}`);
  return { ok: true, data: data ?? [] };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    const userId = data.user?.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify admin status
    const isAdmin = await requireAdmin(userId);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    // Routes
    if (pathname === "/admin-industry-config/definitions" && method === "GET") {
      return new Response(JSON.stringify(await listDefinitions()), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/admin-industry-config/definitions" && method === "POST") {
      const payload = await req.json();
      return new Response(JSON.stringify(await createDefinition(userId, payload)), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname.startsWith("/admin-industry-config/definitions/") && method === "GET") {
      const id = pathname.split("/")[3];
      return new Response(JSON.stringify(await getDefinition(id)), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname.startsWith("/admin-industry-config/definitions/") && method === "PUT") {
      const id = pathname.split("/")[3];
      const payload = await req.json();
      return new Response(JSON.stringify(await updateDefinition(userId, id, payload)), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname.startsWith("/admin-industry-config/workflows?definition_id=") && method === "GET") {
      const defId = url.searchParams.get("definition_id");
      if (!defId) throw new Error("definition_id required");
      return new Response(JSON.stringify(await listWorkflows(defId)), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/admin-industry-config/workflows" && method === "POST") {
      const payload = await req.json();
      return new Response(JSON.stringify(await createWorkflow(userId, payload)), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/admin-industry-config/audit-log" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") ?? "50");
      const offset = parseInt(url.searchParams.get("offset") ?? "0");
      return new Response(JSON.stringify(await getAuditLog(limit, offset)), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 404
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : message.includes("required") ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
});
