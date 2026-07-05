import Layout from "@/components/Layout";
import DemoNumberCard from "@/components/DemoNumberCard";
import SampleConversation from "@/components/SampleConversation";
import SampleLeadCard from "@/components/SampleLeadCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Demo() {
  return (
    <Layout>
      <section className="bg-hero">
        <div className="container py-16 md:py-20 text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Try It Live</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Call the demo. Hear what your customers will hear.</h1>
          <p className="mt-4 text-muted-foreground text-lg">
            No sign-up. No setup. Just call the number and have a conversation.
          </p>
        </div>
      </section>

      <section className="container -mt-6 md:-mt-10 pb-16 grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <DemoNumberCard />
          <SampleConversation />
        </div>
        <div>
          <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
            What you receive after a call
          </p>
          <SampleLeadCard />
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="bg-cta hover:opacity-90 shadow-glow h-12 flex-1">
              <Link to="/start">Get Started — $99 + $249/mo</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 flex-1 border-primary/40">
              <Link to="/support">Talk to a human</Link>
            </Button>
          </div>
        </div>
      </section>

    </Layout>
  );
}