import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Legacy mode: existing /start flow passes { clientId }.
// New mode: /signup passes { mode: "signup", business_name, industry, monthly_amount_cents? }
// with a Bearer auth token identifying the new user.
const LegacyBody = z.object({ clientId: z.string().uuid() });
const SignupBody = z.object({
  mode: z.literal("signup"),
  business_name: z.string().min(1).max(160),
  industry: z.string().min(1).max(80),
  monthly_amount_cents: z.number().int().positive().optional(),
});

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

    const rawBody = await req.json().catch(() => ({}));
    const origin = req.headers.get("origin") ?? "https://trycallcapture.com";

    // ---------- NEW signup flow ----------
    const signupParsed = SignupBody.safeParse(rawBody);
    if (signupParsed.success) {
      const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ error: "Missing Authorization header" }, 401);
      }
      const token = authHeader.slice("Bearer ".length);
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData.user) {
        console.error("auth.getUser failed", userErr);
        return json({ error: "Invalid session" }, 401);
      }
      const user = userData.user;
      const { business_name, industry, monthly_amount_cents } = signupParsed.data;
      const amount = monthly_amount_cents ?? 9900;

      // Reuse or create Stripe customer for this user
      const found = await stripe.customers.list({ email: user.email ?? undefined, limit: 1 });
      const customer = found.data[0] ?? (await stripe.customers.create({
        email: user.email ?? undefined,
        name: business_name,
        metadata: { user_id: user.id, business_name, industry },
      }));

      // Make sure metadata reflects the latest user_id/business (in case we reused).
      if (!customer.metadata?.user_id) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, user_id: user.id, business_name, industry },
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customer.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              recurring: { interval: "month" },
              unit_amount: amount,
              product_data: {
                name: "Vektuor — Monthly",
                description: "AI receptionist · Free setup (limited time).",
              },
            },
          },
        ],
        success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/signup?canceled=1`,
        metadata: {
          flow: "signup",
          user_id: user.id,
          business_name,
          industry,
        },
        subscription_data: {
          metadata: {
            flow: "signup",
            user_id: user.id,
            business_name,
            industry,
          },
        },
      });

      console.log("signup checkout session created", { userId: user.id, sessionId: session.id });
      return json({ url: session.url, sessionId: session.id });
    }

    // ---------- LEGACY clientId flow (unchanged) ----------
    const parsed = LegacyBody.safeParse(rawBody);
    if (!parsed.success) return json({ error: "Invalid body" }, 400);
    const { clientId } = parsed.data;

    // Require auth on legacy flow and verify ownership of the client record.
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const legacyToken = authHeader.slice("Bearer ".length);
    const { data: legacyUserData, error: legacyUserErr } = await supabase.auth.getUser(legacyToken);
    if (legacyUserErr || !legacyUserData.user) {
      console.error("legacy auth.getUser failed", legacyUserErr);
      return json({ error: "Invalid session" }, 401);
    }
    const legacyUser = legacyUserData.user;

    const { data: client, error: clientErr } = await supabase
      .from("callcapture_clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr || !client) {
      console.error("client lookup failed", clientErr);
      return json({ error: "Client not found" }, 404);
    }

    // Only the owner of the client record (or an unowned record matching their email) can checkout.
    const ownsById = client.user_id && client.user_id === legacyUser.id;
    const ownsByEmail = !client.user_id && client.email && legacyUser.email &&
      client.email.toLowerCase() === legacyUser.email.toLowerCase();
    if (!ownsById && !ownsByEmail) {
      console.warn("legacy checkout forbidden", { clientId, userId: legacyUser.id });
      return json({ error: "Forbidden" }, 403);
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