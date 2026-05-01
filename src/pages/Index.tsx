import { Link } from "react-router-dom";
import { Phone, Check, ArrowRight, Wrench, Snowflake, Zap, KeyRound, Sparkles, Scale, Building2, Droplet, HandHeart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import DemoNumberCard from "@/components/DemoNumberCard";
import SampleConversation from "@/components/SampleConversation";
import SampleLeadCard from "@/components/SampleLeadCard";
import RequestSetupBanner from "@/components/RequestSetupBanner";
import { DEMO_NUMBER, DEMO_NUMBER_TEL } from "@/lib/constants";
import { RECEPTIONIST_FLOW, RECEPTIONIST_OPENING, RECEPTIONIST_CLOSING, RECEPTIONIST_DONTS } from "@/lib/receptionistScript";

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
  "24/7 call answering — never miss another call",
  "Lead capture (name, phone, address, job)",
  "SMS lead notifications",
  "Call forwarding from your existing number",
  "Custom script for your business",
  "After-hours handling — nights & weekends",
];

export default function Index() {
  return (
    <Layout>
      {/* HERO */}
      <section className="bg-hero">
        <div className="container pt-12 pb-8 md:pt-16 md:pb-10 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-primary mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Turn missed calls into booked jobs
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
              Stop Missing Service Calls — <span className="text-primary">Even After Hours</span>
            </h1>
            <p className="mt-5 text-lg md:text-2xl font-semibold">
              Answer every call. Capture details. Get booked jobs.
            </p>
            <p className="mt-3 text-base md:text-lg text-primary font-semibold">
              Every missed call is a lost $150–$500 job.
            </p>
            <p className="mt-2 text-sm md:text-base text-foreground font-semibold">
              Miss just 2 calls a day = $6,000–$15,000/month lost.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-4">
              <div className="flex flex-col">
                <Button asChild size="lg" className="bg-cta hover:opacity-90 shadow-glow text-base h-14 px-8 font-bold">
                  <a href={`tel:${DEMO_NUMBER_TEL}`}><Phone className="h-5 w-5" /> Call the Demo</a>
                </Button>
                <p className="mt-1.5 text-xs text-muted-foreground text-center">Takes 30 seconds</p>
              </div>
              <div className="flex flex-col">
                <Button asChild size="lg" variant="outline" className="text-base h-14 px-7 border-primary/40">
                  <Link to="/support">Get Set Up in 24 Hours <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <p className="mt-1.5 text-xs text-muted-foreground text-center">We'll handle everything for you</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Built for appliance repair, HVAC, plumbing, electrical, and local service businesses.
            </p>
          </div>
          <div className="lg:pl-8">
            <DemoNumberCard />
          </div>
        </div>
        <div className="border-t border-border/60 bg-card/40">
          <div className="container py-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> No contracts</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Live in 24 hours</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> Pays for itself with 1–2 jobs</span>
          </div>
        </div>
      </section>

      {/* TRY IT LIVE */}
      <section id="try-it-live" className="container py-20 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Hear it for yourself</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Try It Live</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Call <a href={`tel:${DEMO_NUMBER_TEL}`} className="text-primary font-semibold hover:underline">{DEMO_NUMBER}</a> to hear exactly what your customers experience.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">No signup. Takes 30 seconds.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 items-start max-w-5xl mx-auto">
          <div>
            <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">This is exactly how your calls are handled</p>
            <SampleConversation />
          </div>
          <div>
            <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Sent to your phone instantly</p>
            <SampleLeadCard />
          </div>
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild size="lg" className="bg-cta hover:opacity-90 shadow-glow text-base h-12 px-8">
            <Link to="/support">Get Set Up in 24 Hours <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* WHAT IT ACTUALLY DOES */}
      <section className="container py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">No fluff</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Here's exactly what your receptionist does</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Short. Natural. Designed to capture the lead and hang up fast.
          </p>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* The flow */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card-soft">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">The flow</p>
            <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 mb-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Opens with</p>
              <p className="font-semibold">"{RECEPTIONIST_OPENING}"</p>
            </div>
            <ol className="space-y-3">
              {RECEPTIONIST_FLOW.map((step, i) => (
                <li key={step.label} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold text-sm">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{step.label}</p>
                    <p className="font-medium">"{step.line}"</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-xl bg-secondary/60 border border-border px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Closes with</p>
              <p className="font-medium text-sm">"{RECEPTIONIST_CLOSING}"</p>
            </div>
          </div>

          {/* What it never does */}
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card-soft">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">What it never does</p>
            <ul className="space-y-3">
              {RECEPTIONIST_DONTS.map((d) => (
                <li key={d} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                    <X className="h-4 w-4" />
                  </span>
                  <p className="font-medium pt-0.5">{d}</p>
                </li>
              ))}
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                  <X className="h-4 w-4" />
                </span>
                <p className="font-medium pt-0.5">Waste your customer's time</p>
              </li>
            </ul>
            <div className="mt-6 rounded-xl bg-primary/10 border border-primary/30 p-4">
              <p className="text-sm font-semibold">Average call: under 90 seconds.</p>
              <p className="text-sm text-muted-foreground mt-1">
                You get the lead by SMS before they hang up.
              </p>
            </div>
          </div>
        </div>

        {/* Existing customers too */}
        <div className="mt-6 max-w-5xl mx-auto rounded-2xl border border-primary/30 bg-primary/5 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Check className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Existing customers calling back? Handled.</p>
            <p className="text-sm text-muted-foreground mt-1">
              If a caller says "I already have an appointment" or "I need a callback," the receptionist takes a quick message and flags it as an <span className="font-semibold text-foreground">Existing Customer Request</span> — high priority if they're upset or waiting.
            </p>
          </div>
        </div>
      </section>

      {/* COST OF MISSED CALLS */}
      <section className="container py-16">
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {[
            { stat: "62%", label: "of calls to small businesses go unanswered" },
            { stat: "$150–$500", label: "average value of a single service call" },
          ].map((s) => (
            <div key={s.stat} className="rounded-2xl border border-border bg-card p-6 text-center shadow-card-soft">
              <p className="text-4xl font-bold text-primary">{s.stat}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
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
            "Forward your business number to TryCallCapture",
            "We set up your AI receptionist with your script",
            "Calls get answered 24/7 — even after hours",
            "Get new leads sent to your phone instantly",
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

      {/* DONE FOR YOU */}
      <section className="container py-20">
        <div className="rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12 shadow-glow max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cta text-primary-foreground shadow-glow">
              <HandHeart className="h-6 w-6" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Done for you</p>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">We'll Set This Up For You</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Don't want to deal with setup or tech?
          </p>
          <p className="mt-2 text-base md:text-lg font-medium">We handle everything:</p>
          <ul className="mt-6 space-y-3">
            {[
              "Your call script",
              "Your AI receptionist",
              "Your call routing",
              "Your SMS alerts",
            ].map((b) => (
              <li key={b} className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="font-medium">{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-base md:text-lg text-primary font-semibold">
            You just forward your number and start getting jobs.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="bg-cta hover:opacity-90 shadow-glow text-base h-14 px-8 font-bold">
              <Link to="/support">Request Setup Help <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">Live in 24 hours.</p>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="container py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple pricing</h2>
          <p className="mt-3 text-muted-foreground">One plan. Pays for itself with 1–2 captured jobs.</p>
        </div>
        <div className="max-w-md mx-auto rounded-2xl border-2 border-primary bg-card p-8 shadow-glow">
            <p className="text-xs uppercase tracking-widest text-primary font-semibold">TryCallCapture Pro</p>
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
          <div className="mt-6 rounded-xl bg-primary/10 border border-primary/30 p-4 space-y-1.5">
            <p className="text-sm font-semibold">Most customers recover their cost with the first 1–2 calls.</p>
            <p className="text-sm text-muted-foreground">If you miss even one job per day, this pays for itself fast.</p>
          </div>
          <Button asChild size="lg" className="w-full mt-6 bg-cta hover:opacity-90 shadow-glow h-12">
            <Link to="/support">Get Set Up in 24 Hours</Link>
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-3">Cancel anytime. No contracts.</p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-hero border-t border-border/60">
        <div className="container py-20 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Stop Missing Calls <span className="text-primary">Starting Today</span>
          </h2>
          <p className="mt-5 text-lg md:text-xl font-semibold">
            Your customers are calling. Right now.
          </p>
          <p className="mt-2 text-base md:text-lg text-muted-foreground">
            If you don't answer, someone else will.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-cta hover:opacity-90 shadow-glow text-base h-14 px-8 font-bold">
              <a href={`tel:${DEMO_NUMBER_TEL}`}><Phone className="h-5 w-5" /> Call the Demo</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base h-14 px-7 border-primary/40">
              <Link to="/support">Get Set Up in 24 Hours <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <RequestSetupBanner />
    </Layout>
  );
}
