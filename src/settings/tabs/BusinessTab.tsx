import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { UseControlCenterData } from "../useControlCenterData";
import IndustryCombobox from "../IndustryCombobox";
import { findIndustryGroup } from "@/lib/industries";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type NotesField = { notes?: string };

function notesValue(value: unknown): string {
  if (value && typeof value === "object" && "notes" in value) {
    return String((value as NotesField).notes ?? "");
  }
  return "";
}

export default function BusinessTab({ ctx }: { ctx: UseControlCenterData }) {
  const { data, update, save, saving } = ctx;
  const hours = (data.business_hours_schedule || {}) as Record<
    string,
    { open: string; close: string; closed: boolean }
  >;
  const serviceArea = (data.service_area || {}) as {
    cities?: string[];
    zips?: string[];
    radius_miles?: number;
  };

  async function onSave() {
    const { error } = await save({
      business_name: data.business_name,
      owner_name: data.owner_name,
      business_phone: data.business_phone,
      business_email: data.business_email,
      email: data.email,
      address: data.address,
      website: data.website,
      timezone: data.timezone,
      industry: data.industry,
      business_category_group: data.business_category_group,
      business_hours_schedule: data.business_hours_schedule,
      service_area: data.service_area,
      emergency_services: data.emergency_services,
      emergency_rules: data.emergency_rules,
      holiday_hours: data.holiday_hours,
    });
    if (error) toast({ title: "Save failed", description: (error as Error).message, variant: "destructive" });
    else toast({ title: "Business saved" });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Business Profile</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Business Name" value={data.business_name} onChange={(v) => update({ business_name: v })} />
          <Field label="Owner Name" value={data.owner_name} onChange={(v) => update({ owner_name: v })} />
          <Field label="Business Phone" type="tel" value={data.business_phone} onChange={(v) => update({ business_phone: v })} />
          <Field label="Business Email" type="email" value={data.business_email || data.email} onChange={(v) => update({ business_email: v })} />
          <Field label="Business Address" value={data.address} onChange={(v) => update({ address: v })} />
          <Field label="Website" value={data.website} onChange={(v) => update({ website: v })} />
          <Field label="Time Zone" value={data.timezone || "America/New_York"} onChange={(v) => update({ timezone: v })} />
          <div className="space-y-2">
            <Label>Business Category</Label>
            <IndustryCombobox
              value={data.industry || ""}
              onChange={(industry, group) => update({ industry, business_category_group: group })}
            />
            {data.business_category_group && (
              <p className="text-xs text-muted-foreground">
                Group: {findIndustryGroup(data.industry)?.label}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Business Hours</h2>
        <div className="rounded-xl border border-border divide-y">
          {DAYS.map((d) => {
            const h = hours[d] || { open: "09:00", close: "17:00", closed: d === "Sun" };
            return (
              <div key={d} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="w-10 font-medium">{d}</span>
                <div className="flex items-center gap-2 ml-auto">
                  {!h.closed ? (
                    <>
                      <Input type="time" value={h.open} onChange={(e) => update({ business_hours_schedule: { ...hours, [d]: { ...h, open: e.target.value } } })} className="h-8 w-24" />
                      <span>–</span>
                      <Input type="time" value={h.close} onChange={(e) => update({ business_hours_schedule: { ...hours, [d]: { ...h, close: e.target.value } } })} className="h-8 w-24" />
                    </>
                  ) : (
                    <span className="text-muted-foreground">Closed</span>
                  )}
                  <div className="flex items-center gap-2 pl-2">
                    <span className="text-xs text-muted-foreground">Closed</span>
                    <Switch checked={!!h.closed} onCheckedChange={(c) => update({ business_hours_schedule: { ...hours, [d]: { ...h, closed: c } } })} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Service Area</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Cities (comma separated)</Label>
            <Input
              value={(serviceArea.cities || []).join(", ")}
              onChange={(e) => update({ service_area: { ...serviceArea, cities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
              placeholder="Miami, Coral Gables, Kendall"
            />
          </div>
          <div className="space-y-2">
            <Label>Zip codes (comma separated)</Label>
            <Input
              value={(serviceArea.zips || []).join(", ")}
              onChange={(e) => update({ service_area: { ...serviceArea, zips: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
              placeholder="33101, 33134"
            />
          </div>
          <div className="space-y-2">
            <Label>Service radius (miles)</Label>
            <Input
              type="number"
              value={serviceArea.radius_miles ?? ""}
              onChange={(e) => update({ service_area: { ...serviceArea, radius_miles: Number(e.target.value) || 0 } })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Emergency Services</h2>
        <div className="flex items-center gap-3">
          <Switch checked={!!data.emergency_services} onCheckedChange={(c) => update({ emergency_services: c })} />
          <span className="text-sm">Offer 24/7 emergency service</span>
        </div>
        {data.emergency_services && (
          <Textarea
            placeholder="When are emergency calls accepted? Any surcharge? Eligibility rules?"
            value={notesValue(data.emergency_rules)}
            onChange={(e) => update({ emergency_rules: { ...((data.emergency_rules as Record<string, unknown>) || {}), notes: e.target.value } })}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Holiday Hours</h2>
        <Textarea
          placeholder='e.g. "Closed Dec 25, Jan 1. Open 9-1 on Thanksgiving."'
          value={notesValue(data.holiday_hours)}
          onChange={(e) => update({ holiday_hours: { notes: e.target.value } })}
        />
      </section>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="bg-cta hover:opacity-90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Business
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value?: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}