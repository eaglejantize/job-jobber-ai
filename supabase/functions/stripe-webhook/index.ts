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
        const clientId = session.metadata?.client_id;
        if (!clientId) {
          console.warn("checkout.session.completed without client_id");
          break;
        }
        const update = {
          payment_status: "Active",
          setup_status: "Setup In Progress",
          stripe_subscription_id: (session.subscription as string) ?? null,
          stripe_customer_id: (session.customer as string) ?? null,
        };
        const { error } = await supabase
          .from("callcapture_clients")
          .update(update)
          .eq("id", clientId);
        if (error) console.error("update failed", error);
        else console.log("client activated", clientId);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status;
        const payment_status =
          status === "active" || status === "trialing" ? "Active"
          : status === "past_due" || status === "unpaid" ? "Past Due"
          : status === "canceled" || status === "incomplete_expired" ? "Canceled"
          : "Inactive";
        const { error } = await supabase
          .from("callcapture_clients")
          .update({ payment_status })
          .eq("stripe_subscription_id", sub.id);
        if (error) console.error("sub update failed", error);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { error } = await supabase
          .from("callcapture_clients")
          .update({ payment_status: "Canceled" })
          .eq("stripe_subscription_id", sub.id);
        if (error) console.error("sub delete update failed", error);
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