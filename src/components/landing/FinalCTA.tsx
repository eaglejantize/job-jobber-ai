import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="bg-background">
      <div className="container py-20 md:py-28">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-navy px-8 py-16 text-center text-white shadow-elevated md:px-16 md:py-24">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(217_91%_60%/0.35),transparent)]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
              Stop missing customer calls.
            </h2>
            <p className="mt-4 text-balance text-lg text-white/70">
              Start capturing leads 24/7 with Vektuor.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-navy hover:bg-white/90 rounded-xl h-12 px-7 text-base">
                <Link to="/auth">Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl h-12 px-7 text-base border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/support">Talk to us</Link>
              </Button>
            </div>
            <div className="mt-4 text-xs text-white/50">14-day free trial · No credit card required</div>
          </div>
        </div>
      </div>
    </section>
  );
}