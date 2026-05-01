import { User, Phone, MapPin, Wrench, AlertCircle, FileText } from "lucide-react";

export default function SampleLeadCard() {
  const rows = [
    { icon: User, label: "Name", value: "Sarah Johnson" },
    { icon: Phone, label: "Phone", value: "(904) 555-0198" },
    { icon: MapPin, label: "Address", value: "123 Main St, Jacksonville, FL" },
    { icon: Wrench, label: "Service Needed", value: "Refrigerator not cooling" },
    { icon: AlertCircle, label: "Urgency", value: "High" },
    { icon: FileText, label: "Call Summary", value: "Caller needs refrigerator repair and wants a callback today." },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card-soft overflow-hidden">
      <div className="bg-cta px-5 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-primary-foreground">New Lead Captured</p>
        <span className="text-[10px] uppercase tracking-wider text-primary-foreground/80">Sample</span>
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