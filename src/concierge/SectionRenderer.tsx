import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import IndustryCombobox from "@/settings/IndustryCombobox";
import ActionBar from "./ActionBar";
import type { SectionId } from "./sections";
import type { UseConcierge } from "./useConcierge";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getValue(ctx: UseConcierge, key: string) {
  if (key in ctx.pending) return (ctx.pending as any)[key];
  return (ctx.current as any)?.[key];
}

function Suggested() {
  return (
    <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wide">
      Suggested
    </Badge>
  );
}

function isPending(ctx: UseConcierge, key: string) {
  return key in ctx.pending;
}

export default function SectionRenderer({
  sectionId,
  ctx,
}: {
  sectionId: SectionId;
  ctx: UseConcierge;
}) {
  const set = ctx.setField;
  const disableGbp = !ctx.current?.address && !ctx.current?.website;

  switch (sectionId) {
    case "business_profile":
      return (
        <div className="space-y-3">
          {[
            ["business_name", "Business name"],
            ["business_phone", "Business phone"],
            ["business_email", "Business email"],
            ["address", "Address"],
            ["website", "Website"],
          ].map(([k, l]) => (
            <div key={k}>
              <Label>
                {l}
                {isPending(ctx, k) && <Suggested />}
              </Label>
              <Input
                value={String(getValue(ctx, k) ?? "")}
                onChange={(e) => set(k, e.target.value)}
                placeholder={l}
              />
            </div>
          ))}
        </div>
      );

    case "industry":
      return (
        <div className="space-y-2">
          <Label>Industry{isPending(ctx, "industry") && <Suggested />}</Label>
          <IndustryCombobox
            value={String(getValue(ctx, "industry") ?? "")}
            onChange={(industry, group) => {
              set("industry", industry);
              set("business_category_group", group);
            }}
          />
        </div>
      );

    case "services": {
      const list = (getValue(ctx, "services") as string[] | null) ?? [];
      return (
        <div className="space-y-3">
          <Label>Services{isPending(ctx, "services") && <Suggested />}</Label>
          <div className="space-y-2">
            {list.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={s}
                  onChange={(e) => {
                    const next = [...list];
                    next[i] = e.target.value;
                    set("services", next);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => set("services", list.filter((_, j) => j !== i))}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => set("services", [...list, ""])}
              type="button"
            >
              <Plus className="h-4 w-4" /> Add service
            </Button>
          </div>
          <ActionBar
            section="services"
            currentValue={list}
            disableGbp={disableGbp}
            onResult={(v) => Array.isArray(v) && set("services", v)}
          />
        </div>
      );
    }

    case "hours": {
      const open247 = !!getValue(ctx, "business_hours_24_7");
      const schedule = (getValue(ctx, "business_hours_schedule") as Record<
        string,
        { open: string; close: string; closed: boolean }
      > | null) ?? {};
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={open247}
              onCheckedChange={(v) => set("business_hours_24_7", v)}
            />
            <Label>Open 24/7</Label>
            {isPending(ctx, "business_hours_24_7") && <Suggested />}
          </div>
          {!open247 && (
            <div className="space-y-2">
              {DAYS.map((d) => {
                const row = schedule[d] ?? { open: "09:00", close: "17:00", closed: false };
                return (
                  <div key={d} className="grid grid-cols-[110px_auto_auto_auto] items-center gap-2">
                    <span className="text-sm">{d}</span>
                    <Switch
                      checked={!row.closed}
                      onCheckedChange={(v) =>
                        set("business_hours_schedule", {
                          ...schedule,
                          [d]: { ...row, closed: !v },
                        })
                      }
                    />
                    <Input
                      type="time"
                      value={row.open}
                      disabled={row.closed}
                      onChange={(e) =>
                        set("business_hours_schedule", {
                          ...schedule,
                          [d]: { ...row, open: e.target.value },
                        })
                      }
                    />
                    <Input
                      type="time"
                      value={row.close}
                      disabled={row.closed}
                      onChange={(e) =>
                        set("business_hours_schedule", {
                          ...schedule,
                          [d]: { ...row, close: e.target.value },
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    case "service_area": {
      const sa = (getValue(ctx, "service_area") as {
        cities?: string[];
        zips?: string[];
        radius_miles?: number;
      } | null) ?? {};
      return (
        <div className="space-y-3">
          <div>
            <Label>Cities (comma-separated){isPending(ctx, "service_area") && <Suggested />}</Label>
            <Input
              value={(sa.cities ?? []).join(", ")}
              onChange={(e) =>
                set("service_area", {
                  ...sa,
                  cities: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div>
            <Label>ZIP codes (comma-separated)</Label>
            <Input
              value={(sa.zips ?? []).join(", ")}
              onChange={(e) =>
                set("service_area", {
                  ...sa,
                  zips: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div>
            <Label>Radius (miles)</Label>
            <Input
              type="number"
              value={sa.radius_miles ?? ""}
              onChange={(e) =>
                set("service_area", {
                  ...sa,
                  radius_miles: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <ActionBar
            section="service_area"
            currentValue={sa}
            disableGbp={disableGbp}
            onResult={(v) => v && typeof v === "object" && set("service_area", v)}
          />
        </div>
      );
    }

    case "emergency": {
      const enabled = !!getValue(ctx, "emergency_services");
      const rules = (getValue(ctx, "emergency_rules") as { notes?: string } | null) ?? {};
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              onCheckedChange={(v) => set("emergency_services", v)}
            />
            <Label>We offer emergency service</Label>
            {isPending(ctx, "emergency_services") && <Suggested />}
          </div>
          {enabled && (
            <div>
              <Label>Emergency rules / notes{isPending(ctx, "emergency_rules") && <Suggested />}</Label>
              <Textarea
                rows={4}
                value={rules.notes ?? ""}
                onChange={(e) => set("emergency_rules", { ...rules, notes: e.target.value })}
                placeholder="When do you accept emergencies? Are there extra fees? Hours?"
              />
            </div>
          )}
          <ActionBar
            section="emergency"
            currentValue={{ enabled, notes: rules.notes ?? "" }}
            disableGbp={disableGbp}
            onResult={(v) => {
              if (v && typeof v === "object") {
                const o = v as { enabled?: boolean; notes?: string };
                if (typeof o.enabled === "boolean") set("emergency_services", o.enabled);
                if (typeof o.notes === "string") set("emergency_rules", { ...rules, notes: o.notes });
              }
            }}
          />
        </div>
      );
    }

    case "scheduling": {
      const enabled = !!getValue(ctx, "scheduling_enabled");
      const mode = String(getValue(ctx, "scheduling_mode") ?? "intake_only");
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              onCheckedChange={(v) => set("scheduling_enabled", v)}
            />
            <Label>Let the AI handle scheduling</Label>
          </div>
          {enabled && (
            <div className="space-y-2">
              <Label>Mode</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  ["intake_only", "Capture intake only"],
                  ["book_calendar", "Book on my calendar"],
                  ["transfer_to_office", "Transfer to office"],
                ].map(([v, l]) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={mode === v ? "default" : "outline"}
                    onClick={() => set("scheduling_mode", v)}
                  >
                    {l}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    case "fee": {
      const v = getValue(ctx, "diagnostic_fee");
      return (
        <div>
          <Label>Diagnostic / service fee (USD){isPending(ctx, "diagnostic_fee") && <Suggested />}</Label>
          <Input
            type="number"
            value={v ?? ""}
            onChange={(e) => set("diagnostic_fee", e.target.value ? Number(e.target.value) : null)}
            placeholder="89"
          />
        </div>
      );
    }

    case "greeting": {
      const v = String(getValue(ctx, "greeting") ?? "");
      return (
        <div className="space-y-3">
          <Label>First message{isPending(ctx, "greeting") && <Suggested />}</Label>
          <Textarea
            rows={3}
            value={v}
            onChange={(e) => set("greeting", e.target.value)}
            placeholder="Thanks for calling Acme Plumbing, how can I help?"
          />
          <ActionBar
            section="greeting"
            currentValue={v}
            disableGbp={disableGbp}
            onResult={(val) => typeof val === "string" && set("greeting", val)}
          />
        </div>
      );
    }

    case "after_hours": {
      const v = String(getValue(ctx, "after_hours_message") ?? "");
      return (
        <div className="space-y-3">
          <Label>After-hours message{isPending(ctx, "after_hours_message") && <Suggested />}</Label>
          <Textarea
            rows={3}
            value={v}
            onChange={(e) => set("after_hours_message", e.target.value)}
          />
          <ActionBar
            section="after_hours"
            currentValue={v}
            disableGbp={disableGbp}
            onResult={(val) => typeof val === "string" && set("after_hours_message", val)}
          />
        </div>
      );
    }

    case "sms_followup": {
      const v = String(getValue(ctx, "sms_followup_template") ?? "");
      return (
        <div className="space-y-3">
          <Label>SMS follow-up template{isPending(ctx, "sms_followup_template") && <Suggested />}</Label>
          <Textarea
            rows={3}
            value={v}
            onChange={(e) => set("sms_followup_template", e.target.value)}
            placeholder="Hi {{name}}, thanks for calling Acme. We'll be in touch shortly!"
          />
          <p className="text-xs text-muted-foreground">
            You can use placeholders like <code>{"{{name}}"}</code>.
          </p>
          <ActionBar
            section="sms_followup"
            currentValue={v}
            disableGbp={disableGbp}
            onResult={(val) => typeof val === "string" && set("sms_followup_template", val)}
          />
        </div>
      );
    }

    case "faqs": {
      const list = (getValue(ctx, "faqs") as Array<{ q: string; a: string }> | null) ?? [];
      return (
        <div className="space-y-3">
          <Label>FAQs{isPending(ctx, "faqs") && <Suggested />}</Label>
          {list.map((f, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <Input
                placeholder="Question"
                value={f.q}
                onChange={(e) => {
                  const next = [...list];
                  next[i] = { ...f, q: e.target.value };
                  set("faqs", next);
                }}
              />
              <Textarea
                rows={2}
                placeholder="Answer"
                value={f.a}
                onChange={(e) => {
                  const next = [...list];
                  next[i] = { ...f, a: e.target.value };
                  set("faqs", next);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => set("faqs", list.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" /> Remove
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => set("faqs", [...list, { q: "", a: "" }])}
          >
            <Plus className="h-4 w-4" /> Add FAQ
          </Button>
          <ActionBar
            section="faqs"
            currentValue={list}
            disableGbp={disableGbp}
            onResult={(v) => Array.isArray(v) && set("faqs", v)}
          />
        </div>
      );
    }

    case "policies": {
      const v = String(getValue(ctx, "company_policies") ?? "");
      return (
        <div className="space-y-3">
          <Label>Company policies{isPending(ctx, "company_policies") && <Suggested />}</Label>
          <Textarea
            rows={6}
            value={v}
            onChange={(e) => set("company_policies", e.target.value)}
            placeholder="Cancellation, payments, guarantees, etc."
          />
          <ActionBar
            section="policies"
            currentValue={v}
            disableGbp={disableGbp}
            onResult={(val) => typeof val === "string" && set("company_policies", val)}
          />
        </div>
      );
    }

    default:
      return null;
  }
}