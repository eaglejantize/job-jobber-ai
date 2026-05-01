import { Link } from "react-router-dom";
import { Phone, Check, ArrowRight, Wrench, Snowflake, Zap, KeyRound, Sparkles, Scale, Building2, Droplet } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import DemoNumberCard from "@/components/DemoNumberCard";
import SampleConversation from "@/components/SampleConversation";
import SampleLeadCard from "@/components/SampleLeadCard";
import RequestSetupBanner from "@/components/RequestSetupBanner";

const industries = [
  { name: "Appliance Repair", icon: Wrench },
  { name: "HVAC", icon: Snowflake },
  { name: "Plumbing", icon: Droplet },
  { name: "Electrical", icon: Zap },
  { name: "Locksmiths", icon: KeyRound },
  { name: "Med Spas", icon: Sparkles },
  { name: "Law Firms", icon: Scale },
  { name: "Local Service", icon: Building2 },
];

const features = [
  "24/7 AI call answering",
  "Lead capture (name, phone, address, issue)",
  "SMS notifications",
  "Call forwarding",
  "Custom script",
  "After-hours handling",
];

export default function Index() {
  return (
    <Layout>
      {/* HERO */}
      <section className="bg-hero">
        <div className="container py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-primary mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Turn missed calls into booked jobs
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
              Stop Missing<br />Service Calls
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl">
              CallCapture answers every call, captures customer details, and turns missed calls into booked jobs — automatically.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="bg-cta hover:opacity-90 shadow-glow text-base h-12 px-7">
                <a href="#try-it-live"><Phone className="h-4 w-4" /> Call the Demo</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base h-12 px-7 border-primary/40">
                <Link to="/support">Get Set Up in 24 Hours <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> No contracts</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Live in 24 hours</span>
            </div>
          </div>
          <div className="lg:pl-8">
            <DemoNumberCard />
          </div>
        </div>
      </section>

      {/* COST OF MISSED CALLS */}
      <section className="container py-16">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { stat: "62%", label: "of calls to small businesses go unanswered" },
            { stat: "$1,200+", label: "average value of a single missed service job" },
            { stat: "85%", label: "of callers won't call back if you miss them" },
          ].map((s) => (
            <div key={s.stat} className="rounded-2xl border border-border bg-card p-6 text-center shadow-card-soft">
              <p className="text-4xl font-bold text-primary">{s.stat}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRY IT LIVE */}
      <section id="try-it-live" className="container py-20 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Try It Live</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Hear it for yourself</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Call the demo number. Talk to it like a real customer would. See what your business gets back.
          </p>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <DemoNumberCard />
            <SampleConversation />
          </div>
          <div>
            <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">What you receive after a call</p>
            <SampleLeadCard />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How it works</h2>
          <p className="mt-3 text-muted-foreground">Four steps. No technical skills required.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            "Forward your business number to CallCapture",
            "We set up your AI receptionist with your script",
            "Calls get answered 24/7 — even after hours",
            "Leads sent straight to your phone via SMS",
          ].map((step, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold mb-4">
                {i + 1}
              </div>
              <p className="font-medium">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="container py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Built for service businesses</h2>
          <p className="mt-3 text-muted-foreground">If you live or die by the phone, this is for you.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {industries.map((i) => (
            <div key={i.name} className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
              <i.icon className="h-4 w-4 text-primary" />
              {i.name}
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="container py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple pricing</h2>
          <p className="mt-3 text-muted-foreground">One plan. Pays for itself with 1–2 captured jobs.</p>
        </div>
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
      </section>

      <RequestSetupBanner />
    </Layout>
  );
}
