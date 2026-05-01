import { Phone } from "lucide-react";
import { DEMO_NUMBER, DEMO_NUMBER_AVAILABLE, DEMO_NUMBER_TEL } from "@/lib/constants";

export default function DemoNumberCard() {
  return (
    <div className="rounded-2xl border border-primary/30 bg-card/80 backdrop-blur p-6 md:p-8 shadow-card-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-3">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        Live Demo — Live Now
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Call this number to hear exactly what your customers will experience.
      </p>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cta text-primary-foreground shadow-glow">
          <Phone className="h-5 w-5" />
        </div>
        <div>
          <a
            href={DEMO_NUMBER_AVAILABLE ? `tel:${DEMO_NUMBER_TEL}` : undefined}
            className="block text-2xl md:text-3xl font-bold tracking-wider tabular-nums hover:text-primary transition-colors"
          >
            {DEMO_NUMBER}
          </a>
          <p className="text-xs text-muted-foreground mt-0.5">
            {DEMO_NUMBER_AVAILABLE ? "Tap to call — live now" : "Demo number coming soon"}
          </p>
        </div>
      </div>
    </div>
  );
}