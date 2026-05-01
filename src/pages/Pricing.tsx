import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import RequestSetupBanner from "@/components/RequestSetupBanner";

const features = [
  "24/7 AI call answering",
  "Lead capture (name, phone, address, issue)",
  "SMS notifications",
  "Call forwarding",
  "Custom script",
  "After-hours handling",
];

export default function Pricing() {
  return (
    <Layout>
      <section className="bg-hero">
        <div className="container py-16 md:py-20 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">One simple plan</h1>
          <p className="mt-4 text-muted-foreground text-lg">Pays for itself with 1–2 captured jobs.</p>
        </div>
      </section>

      <section className="container pb-16 -mt-6">
        <div className="max-w-md mx-auto rounded-2xl border-2 border-primary bg-card p-8 shadow-glow">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold">CallCapture Pro</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-5xl font-bold">$197</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">+ $99 one-time setup fee</p>
          <ul className="mt-6 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="w-full mt-8 bg-cta hover:opacity-90 shadow-glow h-12">
            <Link to="/support">Get Set Up in 24 Hours</Link>
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-3">Cancel anytime. No contracts.</p>
        </div>

        <div className="max-w-md mx-auto mt-6 text-center text-sm text-muted-foreground">
          Prefer to set it up yourself?{" "}
          <Link to="/setup" className="text-primary hover:underline">Use our free setup wizard →</Link>
        </div>
      </section>

      <RequestSetupBanner />
    </Layout>
  );
}