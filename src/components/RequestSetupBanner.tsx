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
            <p className="font-semibold">Don't want to do this yourself?</p>
            <p className="text-sm text-muted-foreground">We'll set it up for you in 24 hours.</p>
          </div>
        </div>
        <Button asChild className="bg-cta hover:opacity-90 shadow-glow shrink-0">
          <Link to="/support">Request Setup Help</Link>
        </Button>
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
          We'll build, configure, and connect your AI receptionist in 24 hours. You don't lift a finger.
        </p>
        <Button asChild size="lg" className="bg-cta hover:opacity-90 shadow-glow text-base h-12 px-8">
          <Link to="/support">Request Setup Help</Link>
        </Button>
      </div>
    </section>
  );
}