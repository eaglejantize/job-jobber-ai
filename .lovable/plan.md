## Update Stripe webhook secret

You rotated the previously-exposed `whsec_...` value in Stripe. Now we need to store the new one in Lovable Cloud so the `stripe-webhook` edge function can verify Stripe signatures.

### Step
1. Open the secure secrets form for `STRIPE_WEBHOOK_SECRET` and let you paste the new value.

No code changes. No migrations. The edge function (`supabase/functions/stripe-webhook/index.ts`) already reads `STRIPE_WEBHOOK_SECRET` from the environment, so it will pick up the new value automatically on the next invocation.

Approve to proceed.