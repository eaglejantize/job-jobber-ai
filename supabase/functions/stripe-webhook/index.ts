import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    console.error("Stripe webhook misconfigured");
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch (err) {
    console.error("invalid signature", (err as Error).message);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata ?? {};
        const flow = meta.flow ?? null;

        // ---------- NEW signup flow: create the tenant's business row ----------
        if (flow === "signup") {
          const userId = meta.user_id ?? null;
          const businessName = meta.business_name ?? null;
          const industry = meta.industry ?? null;
          if (!userId || !businessName) {
            console.error("signup checkout missing metadata", { userId, businessName });
            break;
          }
          // Upsert by user_id so retries / multiple completions don't duplicate
          const { data: existing, error: selErr } = await supabase
            .from("callcapture_businesses")
            .select("id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          if (selErr) console.error("business lookup failed", selErr);

          const payload = {
            user_id: userId,
            business_name: businessName,
            industry,
            email: session.customer_details?.email ?? session.customer_email ?? null,
            subscription_status: "active",
            stripe_customer_id: (session.customer as string) ?? null,
            stripe_subscription_id: (session.subscription as string) ?? null,
            stripe_checkout_session_id: session.id,
          };

          if (existing?.id) {
            const { error } = await supabase
              .from("callcapture_businesses")
              .update(payload)
              .eq("id", existing.id);
            if (error) console.error("business update failed", error);
            else console.log("business activated (update)", { userId, id: existing.id });
          } else {
            const { error } = await supabase
              .from("callcapture_businesses")
              .insert(payload);
            if (error) console.error("business insert failed", error);
            else console.log("business activated (insert)", { userId });
          }
          break;
        }

        // ---------- LEGACY clientId flow (unchanged) ----------
        const clientId = meta.client_id ?? null;
        const email =
          session.customer_details?.email ?? session.customer_email ?? null;
        const update = {
          payment_status: "active",
          subscription_status: "active",
          setup_status: "Setup In Progress",
          stripe_subscription_id: (session.subscription as string) ?? null,
          stripe_customer_id: (session.customer as string) ?? null,
        };
        let q = supabase.from("callcapture_clients").update(update);
        if (clientId) q = q.eq("id", clientId);
        else if (email) q = q.ilike("email", email);
        else {
          console.warn("checkout.session.completed without client_id or email");
          break;
        }
        const { error } = await q;
        if (error) console.error("update failed", error);
        else console.log("client activated", { clientId, email });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status;
        const payment_status =
          status === "active" || status === "trialing" ? "active"
          : status === "past_due" || status === "unpaid" ? "past_due"
          : status === "canceled" || status === "incomplete_expired" ? "canceled"
          : "inactive";
        // Legacy clients table
        const { error } = await supabase
          .from("callcapture_clients")
          .update({ payment_status, subscription_status: status })
          .eq("stripe_subscription_id", sub.id);
        if (error) console.error("sub update failed", error);
        // New businesses table
        const { error: bizErr } = await supabase
          .from("callcapture_businesses")
          .update({ subscription_status: status })
          .eq("stripe_subscription_id", sub.id);
        if (bizErr) console.error("business sub update failed", bizErr);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { error } = await supabase
          .from("callcapture_clients")
          .update({ payment_status: "canceled", subscription_status: "canceled" })
          .eq("stripe_subscription_id", sub.id);
        if (error) console.error("sub delete update failed", error);
        const { error: bizErr } = await supabase
          .from("callcapture_businesses")
          .update({ subscription_status: "canceled" })
          .eq("stripe_subscription_id", sub.id);
        if (bizErr) console.error("business sub delete update failed", bizErr);
        break;
      }
      default:
        console.log("ignored event", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("webhook handler error", err);
    return new Response("Handler error", { status: 500 });
  }
});