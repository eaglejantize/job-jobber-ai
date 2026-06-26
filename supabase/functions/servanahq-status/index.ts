import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const base = (Deno.env.get("SERVANAHQ_BASE_URL") ?? "").replace(/\/+$/, "");
  const key = Deno.env.get("SERVANAHQ_API_KEY") ?? "";
  const anon = Deno.env.get("SERVANAHQ_ANON_KEY") ?? "";
  return new Response(
    JSON.stringify({
      configured: !!base && !!key && !!anon,
      has_base_url: !!base,
      has_api_key: !!key,
      has_anon_key: !!anon,
      endpoint: base ? `${base}/intake-vapi` : null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});