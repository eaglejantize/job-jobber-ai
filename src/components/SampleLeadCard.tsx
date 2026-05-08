import { User, Phone, Sparkles, Calendar, UserPlus, FileText } from "lucide-react";

export default function SampleLeadCard() {
  const rows = [
    { icon: User, label: "Name", value: "Sarah Johnson" },
    { icon: Phone, label: "Phone", value: "(904) 555-0198" },
    { icon: Sparkles, label: "Treatment Interest", value: "Botox (first-time client)" },
    { icon: Calendar, label: "Preferred Timing", value: "Within 2 weeks, flexible on day" },
    { icon: UserPlus, label: "Referral Source", value: "Instagram" },
    { icon: FileText, label: "Call Summary", value: "New client interested in Botox consultation. Asked about pricing for forehead and crow's feet. Flexible on timing within the next 2 weeks. Found us on Instagram." },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card-soft overflow-hidden">
      <div className="bg-cta px-5 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-primary-foreground">New Lead Captured</p>
        <span className="text-[10px] uppercase tracking-wider text-primary-foreground/80">Just now</span>
      </div>
      <div className="p-5 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-3">
            <r.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</p>
              <p className="text-sm font-medium">{r.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}