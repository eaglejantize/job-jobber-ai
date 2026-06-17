import { PhoneForwarded, Bot, BellRing } from "lucide-react";

const steps = [
  { icon: PhoneForwarded, title: "Forward your business number", body: "Set up call forwarding in minutes. Keep your existing number — Vektuor answers when you can't." },
  { icon: Bot, title: "AI answers and captures info", body: "Vektuor greets your customer, asks the right questions, and logs every detail in real time." },
  { icon: BellRing, title: "Your team gets notified instantly", body: "New leads land in your inbox and on your phone — with urgent calls transferred live." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="bg-gradient-hero">
      <div className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">How it works</div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-navy md:text-4xl">
            Live in under 10 minutes.
          </h2>
          <p className="mt-4 text-ink">No new hardware. No replacing your phone system. Just better coverage, instantly.</p>
        </div>
        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-9 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-navy text-sm font-semibold text-white">{i + 1}</div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-navy">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}