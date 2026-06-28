import { Badge } from "@/components/ui/badge";
import { findIndustryGroup, industryLabel } from "@/lib/industries";
import { UseControlCenterData } from "../useControlCenterData";

const SCHEMA_FIELDS: { key: string; label: string; description: string }[] = [
  { key: "required_fields", label: "Required Fields", description: "Fields the AI must collect before ending the call." },
  { key: "trade_questions", label: "Trade Questions", description: "Industry-specific diagnostic questions." },
  { key: "urgency_rules", label: "Urgency Rules", description: "Logic that classifies a call as emergency, same-day, or schedule." },
  { key: "scheduling_rules", label: "Scheduling Rules", description: "How appointments are offered, blocked, and confirmed." },
  { key: "service_fee_rules", label: "Service Fee Rules", description: "When and how to disclose diagnostic / dispatch fees." },
  { key: "intake_summary_format", label: "Intake Summary Format", description: "The structured shape of the lead handed to the office." },
];

export default function IndustryWorkflowTab({ ctx }: { ctx: UseControlCenterData }) {
  const { data } = ctx;
  const group = findIndustryGroup(data.industry);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Industry Workflow</h2>
          <p className="text-sm text-muted-foreground">
            Industry-specific intake, urgency, and scheduling logic for{" "}
            <strong>{industryLabel(data.industry) || "your business"}</strong>
            {group && <span className="text-muted-foreground"> · {group.label}</span>}.
          </p>
        </div>
        <Badge variant="secondary">Coming soon</Badge>
      </div>

      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Workflow templates are being prepared. Once enabled, the AI receptionist will follow an industry-specific intake flow automatically — no manual scripting.
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {SCHEMA_FIELDS.map((f) => (
          <div key={f.key} className="rounded-xl border border-border bg-card p-4">
            <p className="font-semibold">{f.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{f.key}</p>
            <p className="text-sm text-muted-foreground mt-2">{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}