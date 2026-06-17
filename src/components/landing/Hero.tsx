import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { PlayCircle, ArrowRight, Phone, MessageSquare, MapPin, CheckCircle2, Bell, Truck, Activity } from "lucide-react";

const DashboardMockup = () => (
  <div className="relative mx-auto w-full max-w-6xl">
    <div className="pointer-events-none absolute -inset-x-10 -top-10 h-[420px] bg-[radial-gradient(closest-side,hsl(217_91%_60%/0.18),transparent)]" />
    <div className="relative rounded-3xl border border-border/70 bg-white shadow-elevated overflow-hidden animate-float">
      <div className="flex items-center justify-between border-b border-border/70 bg-secondary/60 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(0_70%_70%)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(40_85%_65%)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(140_55%_60%)]" />
        </div>
        <div className="text-xs font-medium text-ink">vektuor.app / inbox</div>
        <div className="text-xs text-muted-foreground">Live</div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border/70 bg-white px-4 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-navy">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-soft-pulse" /> System live
        </span>
        <span className="text-muted-foreground"><span className="font-semibold text-navy">12</span> calls today</span>
        <span className="text-muted-foreground"><span className="font-semibold text-navy">4</span> leads captured</span>
        <span className="text-muted-foreground"><span className="font-semibold text-navy">2</span> active now</span>
        <span className="ml-auto hidden text-muted-foreground sm:inline">Avg pickup · 1.8s</span>
      </div>
      <div className="grid grid-cols-12 gap-0">
        <aside className="col-span-3 hidden border-r border-border/70 bg-secondary/30 p-4 lg:block">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inbox</div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {[
              { name: "Sarah Martinez", active: true, sub: "HVAC · No A/C", time: "now", badge: "Live" },
              { name: "Mike Reynolds", sub: "Garage door · Spring", time: "2m", badge: "Booked" },
              { name: "Linda Chen", sub: "Plumbing · Leak", time: "14m", badge: "Transferred" },
              { name: "Devon Park", sub: "Electrical · Panel", time: "11:42 PM", badge: "New" },
            ].map((c, i) => (
              <li key={i} className={`rounded-lg px-3 py-2 ${c.active ? "bg-white border border-border shadow-soft" : "hover:bg-white/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate font-medium ${c.active ? "text-navy" : "text-ink"}`}>{c.name}</span>
                  {c.active ? (
                    <span className="h-2 w-2 flex-none rounded-full bg-brand animate-soft-pulse" />
                  ) : (
                    <span className="flex-none rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-ink">{c.badge}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{c.sub}</span>
                  <span className="flex-none">{c.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <main className="col-span-12 lg:col-span-6 border-r border-border/70 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-navy">Sarah Martinez</div>
                <div className="text-xs text-muted-foreground">+1 (415) 555-0182 · Incoming</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-soft-pulse" /> Live · 00:42
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["HVAC", "Urgent", "Residential"].map((t) => (
              <span key={t} className="rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">{t}</span>
            ))}
          </div>
          <div className="mt-4 flex h-8 items-end gap-0.5">
            {Array.from({ length: 36 }).map((_, i) => (
              <span
                key={i}
                className="flex-1 origin-bottom rounded-sm bg-brand/40 animate-shimmer"
                style={{
                  height: `${30 + Math.abs(Math.sin(i * 0.6) * 70)}%`,
                  animationDelay: `${(i % 9) * 80}ms`,
                }}
              />
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {[
              { who: "AI", text: "Thanks for calling. How can I help today?" },
              { who: "Caller", text: "My air conditioner stopped cooling tonight." },
              { who: "AI", text: "I'm sorry to hear that. Looking for the next available appointment?" },
              { who: "Caller", text: "Yes, please." },
              { who: "AI", text: "Perfect — I've notified dispatch and sent a confirmation text." },
            ].map((m, i) => (
              <div key={i} className={`flex ${m.who === "AI" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${m.who === "AI" ? "bg-secondary text-navy" : "bg-navy text-white"}`}>
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-60">{m.who}</div>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </main>
        <aside className="col-span-12 lg:col-span-3 space-y-4 p-5">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Customer intake
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ["Name", "Sarah Martinez"],
                ["Address", "1248 Elm St, Oakland"],
                ["Issue", "A/C not cooling"],
                ["Urgency", "High"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium text-navy text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-medium text-brand">
              <CheckCircle2 className="h-3.5 w-3.5" /> Lead captured · synced to dispatch
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Truck className="h-3.5 w-3.5" /> Dispatch
            </div>
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-navy text-xs font-semibold text-white">MR</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-navy">Marco R.</div>
                <div className="truncate text-xs text-muted-foreground">ETA 2:15 PM</div>
              </div>
              <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">En route</span>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" /> SMS follow-up
            </div>
            <div className="rounded-xl bg-secondary p-3 text-sm text-navy">
              Hi Sarah — you're booked today 2–4pm. Reply C to confirm.
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">Sent · just now</div>
          </div>
        </aside>
      </div>
    </div>
    <div className="pointer-events-none absolute -bottom-6 left-4 hidden w-72 rounded-2xl border border-border bg-white p-3 shadow-elevated md:block animate-fade-up [animation-delay:300ms]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-navy">New lead captured</div>
          <div className="text-xs text-muted-foreground">Synced to CRM</div>
        </div>
      </div>
    </div>
    <div className="pointer-events-none absolute -top-6 right-4 hidden w-72 rounded-2xl border border-border bg-white p-3 shadow-elevated md:block animate-fade-up [animation-delay:600ms]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-white">
          <Bell className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-navy">SMS confirmation sent</div>
          <div className="text-xs text-muted-foreground">High urgency · ETA 2:15pm</div>
        </div>
      </div>
    </div>
  </div>
);

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-gradient-hero">
      <div className="container pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-medium text-ink shadow-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-soft-pulse" />
            Built for service businesses of every size
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-navy sm:text-5xl md:text-6xl">
            24/7 AI Receptionist for Service Businesses
          </h1>
          <p className="mt-5 text-balance text-lg leading-relaxed text-ink md:text-xl">
            Vektuor answers every call, captures customer details, and notifies you instantly — so you never miss a job.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-navy hover:bg-navy-deep text-white rounded-xl px-6 h-12 text-base">
              <Link to="/auth">Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl px-6 h-12 text-base border-border bg-white text-navy hover:bg-secondary">
              <a href="#pricing"><PlayCircle className="mr-1.5 h-5 w-5" /> See Pricing</a>
            </Button>
          </div>
          <div className="mt-6 text-xs text-muted-foreground">
            14-day free trial · No credit card required · Setup in under 10 minutes
          </div>
        </div>
        <div className="mt-16 md:mt-20">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}