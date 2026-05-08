import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({ clientId: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return json({ error: "Stripe not configured" }, 500);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid body" }, 400);
    const { clientId } = parsed.data;

    const { data: client, error: clientErr } = await supabase
      .from("callcapture_clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr || !client) {
      console.error("client lookup failed", clientErr);
      return json({ error: "Client not found" }, 404);
    }

    // Reuse customer if we already have one
    let customerId = client.stripe_customer_id as string | null;
    if (!customerId) {
      const found = await stripe.customers.list({ email: client.email, limit: 1 });
      const existing = found.data[0];
      const customer = existing ?? (await stripe.customers.create({
        email: client.email,
        name: client.owner_name,
        metadata: { client_id: client.id, business_name: client.business_name },
      }));
      customerId = customer.id;
    }

    const origin = req.headers.get("origin") ?? "https://trycallcapture.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            // $249/month subscription
            unit_amount: 24900,
            product_data: {
              name: "CallCapture Pro — Monthly",
              description: "AI receptionist that answers calls 24/7.",
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            // $99 one-time setup fee
            unit_amount: 9900,
            product_data: {
              name: "CallCapture Setup Fee",
              description: "One-time white-glove setup. Live in 24 hours.",
            },
          },
        },
      ],
      success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/start?canceled=1`,
      metadata: { client_id: client.id },
      subscription_data: { metadata: { client_id: client.id } },
    });

    await supabase
      .from("callcapture_clients")
      .update({
        stripe_customer_id: customerId,
        stripe_checkout_session_id: session.id,
      })
      .eq("id", client.id);

    console.log("checkout session created", { clientId: client.id, sessionId: session.id });
    return json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("create-checkout error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}