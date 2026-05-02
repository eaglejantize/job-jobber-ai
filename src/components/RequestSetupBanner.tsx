import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function RequestSetupBanner({
  variant = "default",
}: { variant?: "default" | "compact" }) {
  if (variant === "compact") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Want us to set this up for you?</p>
            <p className="text-sm text-muted-foreground">We'll do it in 24 hours.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Button asChild className="bg-cta hover:opacity-90 shadow-glow">
            <Link to="/start">Get Started</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/support">Talk to a human</Link>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <section className="container my-20">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-8 md:p-12 text-center shadow-card-soft">
        <Sparkles className="h-7 w-7 text-primary mx-auto mb-3" />
        <h3 className="text-2xl md:text-3xl font-bold mb-2">
          Want us to set this up for you?
        </h3>
        <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
          We'll do it in 24 hours. You don't lift a finger.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-cta hover:opacity-90 shadow-glow text-base h-12 px-8">
            <Link to="/start">Get Started — $99 + $197/mo</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base h-12 px-8">
            <Link to="/support">Talk to a human</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}