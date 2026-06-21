import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import Stripe from "npm:stripe@14";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  client_id: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      console.error("checkout_validation_failed", parsed.error.flatten());
      return json({ error: "validation_failed", details: parsed.error.flatten() }, 400);
    }
    const { client_id } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: client, error: cErr } = await supabase
      .from("callcapture_clients")
      .select("id, email, business_name, owner_name")
      .eq("id", client_id)
      .maybeSingle();
    if (cErr || !client) {
      console.error("checkout_client_not_found", { client_id, error: cErr?.message });
      return json({ error: "client_not_found" }, 404);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("checkout_missing_stripe_key");
      return json({ error: "stripe_not_configured" }, 500);
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const origin = req.headers.get("origin") ?? "https://trycallcapture.com";
    console.log("checkout_started", { client_id, email: client.email });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: client.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            unit_amount: 9900,
            product_data: {
              name: "CallCapture Pro",
              description: "AI receptionist + lead capture",
            },
          },
          quantity: 1,
        },
      ],
      client_reference_id: client_id,
      metadata: { client_id, business_name: client.business_name ?? "" },
      success_url: `${origin}/start?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/start?canceled=1`,
      allow_promotion_codes: true,
    });

    console.log("checkout_success", { client_id, session_id: session.id });
    return json({ url: session.url });
  } catch (err) {
    console.error("checkout_failed", { message: (err as Error).message });
    return json({ error: "checkout_failed", message: (err as Error).message }, 500);
  }
});