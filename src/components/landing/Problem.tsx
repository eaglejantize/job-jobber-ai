import { PhoneOff, Users, Clock, TrendingDown } from "lucide-react";

const items = [
  { icon: PhoneOff, title: "After-hours calls go unanswered", body: "Most service calls happen outside business hours — and most never call back." },
  { icon: Users, title: "Office staff get overwhelmed", body: "Your team can't dispatch jobs and answer every ringing phone at the same time." },
  { icon: Clock, title: "Callbacks come too late", body: "By the time you call back, the customer has already booked your competitor." },
  { icon: TrendingDown, title: "Lost leads = lost revenue", body: "Every missed call is a job walking out the door." },
];

export default function Problem() {
  return (
    <section className="border-y border-border/60 bg-white">
      <div className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">The problem</div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-navy md:text-4xl">
            Missed calls are lost revenue.
          </h2>
          <p className="mt-4 text-ink">
            Service businesses lose thousands every month to calls that never get answered — or get answered too late.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-elevated">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-navy">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}