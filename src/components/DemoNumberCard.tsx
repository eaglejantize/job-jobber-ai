import { Copy } from "lucide-react";
import { DEMO_NUMBER, DEMO_NUMBER_TEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import CallDemoButton from "@/components/CallDemoButton";

export default function DemoNumberCard() {
  function copy() {
    navigator.clipboard.writeText(DEMO_NUMBER).then(() => {
      toast({ title: "Number copied", description: DEMO_NUMBER });
    });
  }
  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-card/80 backdrop-blur p-6 md:p-8 shadow-glow">
      <div className="inline-flex items-center gap-2 rounded-full bg-cta px-3 py-1 text-[11px] uppercase tracking-widest text-primary-foreground font-bold mb-3">
        <span className="h-2 w-2 rounded-full bg-primary-foreground animate-pulse" />
        Live — Call Now
      </div>
      <p className="text-sm font-semibold text-primary mb-2">
        ⚡ Live Demo — Try It Right Now
      </p>
      <a
        href={`tel:${DEMO_NUMBER_TEL}`}
        className="block text-3xl md:text-5xl font-bold tracking-wider tabular-nums hover:text-primary transition-colors"
      >
        {DEMO_NUMBER}
      </a>
      <p className="text-sm text-muted-foreground mt-3">
        Call now and act like a real customer.
      </p>
      <p className="text-sm text-muted-foreground">
        It takes 30 seconds.
      </p>
      <p className="text-sm font-bold text-foreground mt-3">
        No signup. No setup. No commitment.
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        Hear exactly what your customers experience.
      </p>
      <div className="mt-5 flex flex-col sm:flex-row gap-2">
        <CallDemoButton className="bg-cta hover:opacity-90 shadow-glow flex-1" />
        <Button variant="outline" size="sm" onClick={copy} className="border-primary/40">
          <Copy className="h-4 w-4" /> Copy Number
        </Button>
      </div>
    </div>
  );
}
