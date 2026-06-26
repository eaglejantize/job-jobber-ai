// ============================================================================
// REFERENCE IMPLEMENTATION — for the ServanaHQ Supabase project.
//
// Copy this file into the ServanaHQ Supabase project at:
//   supabase/functions/ingest-vektuor-lead/index.ts
//
// Required secrets in the ServanaHQ project:
//   - SERVANAHQ_API_KEY            (must match the value Vektuor stores)
//   - SUPABASE_URL                 (auto-set)
//   - SUPABASE_SERVICE_ROLE_KEY    (auto-set)
//
// Expected ServanaHQ table (adjust column names if your schema differs):
//   public.lead_inbox (
//     id uuid primary key default gen_random_uuid(),
//     tenant_id text not null,
//     source text,
//     lead_source text,
//     customer_name text, phone text, email text,
//     service_address text,
//     business_category text,
//     service_requested text,
//     appliance_type text, brand text, model_number text,
//     issue_description text,
//     preferred_day text, preferred_time text,
//     call_summary text, transcript text,
//     vektuor_call_id text unique,         -- enables idempotent re-sync
//     recording_url text,
//     metadata jsonb,
//     created_at timestamptz not null default now()
//   );
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SERVANAHQ_API_KEY = Deno.env.get("SERVANAHQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  // 1. Auth — bearer token must match the shared SERVANAHQ_API_KEY
  const auth = req.headers.get("Authorization") ?? "";
  if (!SERVANAHQ_API_KEY) {
    console.error("[ingest-vektuor-lead] SERVANAHQ_API_KEY not configured");
    return json(500, { ok: false, error: "Server not configured" });
  }
  if (auth !== `Bearer ${SERVANAHQ_API_KEY}`) {
    console.warn("[ingest-vektuor-lead] auth rejected");
    return json(401, { ok: false, error: "Unauthorized" });
  }
  console.log("[ingest-vektuor-lead] auth accepted");

  // 2. Parse + validate body
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "Invalid JSON" }); }

  const tenantId = (body.servanahq_tenant_id as string | undefined)?.trim();
  if (!tenantId) return json(400, { ok: false, error: "servanahq_tenant_id is required" });

  // 3. Resolve tenant (adapt this to your ServanaHQ schema)
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  // Optional: verify the tenant exists and is not the super-admin tenant.
  // const { data: tenant } = await supabase.from("tenants").select("id, is_super_admin").eq("id", tenantId).maybeSingle();
  // if (!tenant) return json(404, { ok: false, error: "Unknown tenant" });
  // if (tenant.is_super_admin) return json(403, { ok: false, error: "Cannot write to super admin tenant" });
  console.log("[ingest-vektuor-lead] tenant matched", tenantId);

  const row = {
    tenant_id: tenantId,
    source: (body.source as string) ?? "Vektuor",
    lead_source: (body.lead_source as string) ?? "AI Answering Service",
    customer_name: body.customer_name ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    service_address: body.service_address ?? null,
    business_category: body.business_category ?? null,
    service_requested: body.service_requested ?? null,
    appliance_type: body.appliance_type ?? null,
    brand: body.brand ?? null,
    model_number: body.model_number ?? null,
    issue_description: body.issue_description ?? null,
    preferred_day: body.preferred_day ?? null,
    preferred_time: body.preferred_time ?? null,
    call_summary: body.call_summary ?? null,
    transcript: body.transcript ?? null,
    vektuor_call_id: body.vektuor_call_id ?? null,
    recording_url: body.recording_url ?? null,
    metadata: body.metadata ?? {},
  };

  // 4. Upsert by vektuor_call_id for idempotency
  const { data, error } = await supabase
    .from("lead_inbox")
    .upsert(row, { onConflict: "vektuor_call_id" })
    .select("id")
    .single();

  if (error) {
    console.error("[ingest-vektuor-lead] insert failed", error);
    return json(500, { ok: false, error: error.message });
  }

  console.log("[ingest-vektuor-lead] lead created", data?.id);
  return json(200, { ok: true, lead_id: data?.id });
});