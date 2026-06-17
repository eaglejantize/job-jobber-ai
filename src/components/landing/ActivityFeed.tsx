import { PhoneIncoming, PhoneCall, CalendarCheck, Truck, MessageSquare, PhoneForwarded } from "lucide-react";

const items = [
  { icon: PhoneIncoming, text: "New lead captured", meta: "Plumbing intake", time: "4s ago" },
  { icon: PhoneCall, text: "Call answered in 2s", meta: "HVAC inquiry", time: "12s ago" },
  { icon: CalendarCheck, text: "After-hours booking completed", meta: "Med spa consult", time: "38s ago" },
  { icon: Truck, text: "Dispatch notified", meta: "Electrical job", time: "1m ago" },
  { icon: MessageSquare, text: "SMS confirmation sent", meta: "Appointment reminder", time: "2m ago" },
  { icon: PhoneForwarded, text: "Urgent call transferred", meta: "Water leak", time: "3m ago" },
];

export default function ActivityFeed() {
  return (
    <section className="bg-gradient-hero">
      <div className="container py-20 md:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Always on</div>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-navy md:text-4xl">
              A live look at what Vektuor does for you.
            </h2>
            <p className="mt-4 max-w-md text-ink">
              Calls answered, leads captured, follow-ups sent. Vektuor keeps the work moving — even while you sleep.
            </p>
            <div className="mt-6 flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-soft-pulse" /> Live
              </span>
              <span className="text-muted-foreground">Updated continuously</span>
            </div>
          </div>
          <div className="relative rounded-2xl border border-border bg-white p-5 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-navy">Live activity</div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-soft-pulse" /> Live
              </span>
            </div>
            <ul className="feed-mask space-y-2.5">
              {items.map(({ icon: Icon, text, meta, time }, i) => (
                <li
                  key={text}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-white px-3 py-2.5 shadow-soft animate-slide-in-up"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-navy">{text}</div>
                    <div className="truncate text-xs text-muted-foreground">{meta}</div>
                  </div>
                  <span className="flex-none text-xs text-muted-foreground">{time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}