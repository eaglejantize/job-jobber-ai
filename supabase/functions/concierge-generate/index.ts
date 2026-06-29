import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Action = "generate" | "improve" | "professional" | "warmer" | "industry" | "gbp";
type SectionId =
  | "services"
  | "service_area"
  | "emergency"
  | "greeting"
  | "after_hours"
  | "sms_followup"
  | "faqs"
  | "policies";

const SECTION_SCHEMA: Record<SectionId, "string" | "string[]" | "faqs" | "service_area" | "emergency"> = {
  services: "string[]",
  service_area: "service_area",
  emergency: "emergency",
  greeting: "string",
  after_hours: "string",
  sms_followup: "string",
  faqs: "faqs",
  policies: "string",
};

const SECTION_INSTRUCTION: Record<SectionId, string> = {
  services:
    'Return JSON: {"value":["service 1","service 2", ...]} — 4-10 common services for this industry.',
  service_area:
    'Return JSON: {"value":{"cities":["..."],"zips":["..."],"radius_miles":25}}. If unknown, return needs_user_input.',
  emergency:
    'Return JSON: {"value":{"enabled":boolean,"notes":"<short>"}}. Do NOT invent emergency policies — if unknown set needs_user_input.',
  greeting:
    'Return JSON: {"value":"<one short greeting under 25 words, mentions the business name, warm + natural>"}.',
  after_hours:
    'Return JSON: {"value":"<one short after-hours message under 30 words>"}.',
  sms_followup:
    'Return JSON: {"value":"<short SMS template under 280 chars, may use {{name}}>"}.',
  faqs:
    'Return JSON: {"value":[{"q":"...","a":"..."}, ...]} with 4-8 industry-relevant FAQs.',
  policies:
    'Return JSON: {"value":"<2-5 short bullet-style sentences. Never invent prices, licenses, warranties, or guarantees>"}.',
};

const ACTION_PROMPT: Record<Action, string> = {
  generate: "Generate a fresh draft from scratch.",
  improve: "Improve the current value while keeping its intent.",
  professional: "Rewrite to sound more professional, polished, and concise.",
  warmer: "Rewrite to feel warmer, friendlier, and more human.",
  industry: "Tailor the content specifically to this business's industry.",
  gbp: "Use the business's known address/website context to ground the answer.",
};

const SAFETY = `Important safety rules:
- Do NOT invent business hours, prices, licenses, warranties, guarantees, or emergency policies as facts.
- If you would have to invent something material, instead set "needs_user_input": true and explain briefly in "notes".
- Keep tone consistent with a small service business.`;

function bearer(req: Request) {
  const h = req.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = bearer(req);
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userRes } = await admin.auth.getUser(token);
    const uid = userRes?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const section = body.section as SectionId;
    const action = (body.action as Action) || "generate";
    const currentValue = body.currentValue;
    const userNotes = String(body.userNotes ?? "");

    if (!section || !(section in SECTION_INSTRUCTION)) {
      return new Response(JSON.stringify({ error: "Unsupported section" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load client context
    const { data: client } = await admin
      .from("callcapture_clients")
      .select(
        "business_name, industry, business_category_group, address, website, services, business_hours_schedule, service_area, tone, ai_personality",
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ctx = client || {};
    const ctxText = `Business: ${ctx.business_name || "(unknown)"}
Industry: ${ctx.industry || "(unknown)"} / ${ctx.business_category_group || ""}
Address: ${ctx.address || "(unknown)"}
Website: ${ctx.website || "(unknown)"}
Tone: ${ctx.tone || "Friendly"}${ctx.ai_personality ? "; " + ctx.ai_personality : ""}`;

    const sys = `You configure an AI phone receptionist for a small service business.
${SAFETY}
Return ONLY a single JSON object: {"value": <as instructed>, "needs_user_input": boolean (optional), "notes": "<optional>"}.
${SECTION_INSTRUCTION[section]}`;

    const user = `Section: ${section}
Action: ${action} — ${ACTION_PROMPT[action]}

Business context:
${ctxText}

Current value (may be empty): ${JSON.stringify(currentValue)}
User notes: ${userNotes || "(none)"}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: `AI ${r.status}: ${txt}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    const cleaned = String(raw).replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: { value?: unknown; needs_user_input?: boolean; notes?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { value: cleaned };
    }

    // Light shape validation
    const shape = SECTION_SCHEMA[section];
    if (shape === "string[]" && !Array.isArray(parsed.value)) {
      parsed = { ...parsed, value: [] };
    }
    if (shape === "faqs" && !Array.isArray(parsed.value)) {
      parsed = { ...parsed, value: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});