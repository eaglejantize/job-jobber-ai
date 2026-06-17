import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const features = [
  "24/7 AI call answering",
  "Custom intake script per industry",
  "SMS lead notifications",
  "Live call transfer for urgent calls",
  "Call transcripts & history",
  "Cancel anytime — no contracts",
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-gradient-hero">
      <div className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Pricing</div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-navy md:text-4xl">
            Simple pricing that pays for itself in one job.
          </h2>
          <p className="mt-4 text-ink">One plan. No call limits. No surprise fees.</p>
        </div>
        <div className="mx-auto mt-12 max-w-md rounded-3xl border border-brand bg-card p-8 shadow-elevated ring-1 ring-brand/20">
          <div className="text-sm font-semibold text-brand">Vektuor Pro</div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-5xl font-semibold tracking-tight text-navy">$249</span>
            <span className="text-sm text-muted-foreground">/month</span>
          </div>
          <p className="mt-1 text-sm text-ink">+ $99 one-time setup</p>
          <Button asChild className="mt-6 w-full rounded-xl h-12 bg-navy hover:bg-navy-deep text-white text-base">
            <Link to="/auth">Start Free Trial</Link>
          </Button>
          <ul className="mt-6 space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink">
                <Check className="mt-0.5 h-4 w-4 flex-none text-brand" />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            14-day free trial · No credit card required
          </p>
        </div>
      </div>
    </section>
  );
}