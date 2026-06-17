import { PhoneIncoming, PhoneForwarded, MessageSquare, FileText, ClipboardList, Send } from "lucide-react";

const features = [
  { icon: PhoneIncoming, title: "AI Call Answering", body: "Answer customer calls instantly — even after hours.", detail: "Avg pickup · 1.8s" },
  { icon: PhoneForwarded, title: "Live Call Transfer", body: "Urgent calls transfer directly to your on-call team.", detail: "Configurable triggers" },
  { icon: MessageSquare, title: "SMS Follow-Ups", body: "Automatically send confirmations and customer updates.", detail: "Two-way SMS" },
  { icon: FileText, title: "Call Transcripts", body: "Every conversation logged, searchable, and stored.", detail: "Full history" },
  { icon: ClipboardList, title: "Customer Intake", body: "Name, address, issue, and urgency captured on every call.", detail: "Custom fields per industry" },
  { icon: Send, title: "Instant Notifications", body: "New leads pushed to your phone the moment they hang up.", detail: "SMS + email" },
];

export default function Features() {
  return (
    <section id="features" className="bg-white border-y border-border/60">
      <div className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Features</div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-navy md:text-4xl">
            Everything a great receptionist does. Without the overhead.
          </h2>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body, detail }) => (
            <div key={title} className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-elevated">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-base font-semibold text-navy">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink">{body}</p>
              <div className="mt-4 border-t border-border/70 pt-3 text-xs font-medium text-muted-foreground">{detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}