import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, Upload, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { UseControlCenterData } from "../useControlCenterData";

type Faq = { q: string; a: string };

export default function KnowledgeTab({ ctx }: { ctx: UseControlCenterData }) {
  const { data, update, save, saving } = ctx;
  const services: string[] = data.services || [];
  const faqs: Faq[] = (data.faqs as unknown as Faq[]) || [];
  const brands: string[] = data.brands_serviced || [];

  async function onSave() {
    const { error } = await save({
      services: data.services,
      faqs: data.faqs,
      company_policies: data.company_policies,
      warranty_terms: data.warranty_terms,
      brands_serviced: data.brands_serviced,
      service_area_notes: data.service_area_notes,
      knowledge_base: data.knowledge_base,
    });
    if (error) toast({ title: "Save failed", description: (error as Error).message, variant: "destructive" });
    else toast({ title: "Knowledge saved" });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Services Offered</h2>
        <ChipEditor values={services} onChange={(v) => update({ services: v })} placeholder="Add a service…" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Input placeholder="Question" value={f.q} onChange={(e) => {
                  const next = [...faqs]; next[i] = { ...f, q: e.target.value }; update({ faqs: next });
                }} />
                <Button size="icon" variant="ghost" onClick={() => update({ faqs: faqs.filter((_, j) => j !== i) })}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Textarea placeholder="Answer" rows={2} value={f.a} onChange={(e) => {
                const next = [...faqs]; next[i] = { ...f, a: e.target.value }; update({ faqs: next });
              }} />
            </div>
          ))}
          <Button variant="outline" onClick={() => update({ faqs: [...faqs, { q: "", a: "" }] })}>
            <Plus className="h-4 w-4" /> Add FAQ
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Company Policies</h2>
        <Textarea rows={4} value={data.company_policies || ""} onChange={(e) => update({ company_policies: e.target.value })} placeholder="Cancellation policy, payment terms, late fees…" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Warranty</h2>
        <Textarea rows={3} value={data.warranty_terms || ""} onChange={(e) => update({ warranty_terms: e.target.value })} placeholder="Warranty terms and conditions…" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Brands Serviced</h2>
        <ChipEditor values={brands} onChange={(v) => update({ brands_serviced: v })} placeholder="Add a brand…" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Service Area Notes</h2>
        <Textarea rows={3} value={data.service_area_notes || ""} onChange={(e) => update({ service_area_notes: e.target.value })} placeholder="Travel fees, geographic exceptions, surcharges…" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Knowledge Base</h2>
        <Textarea rows={8} value={data.knowledge_base || ""} onChange={(e) => update({ knowledge_base: e.target.value })} placeholder="Anything else the AI receptionist should know. Markdown supported." />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">File Uploads</h2>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Upload className="h-6 w-6 mx-auto mb-2" />
          Upload PDFs, price sheets, and brochures. Available in a future update.
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="bg-cta hover:opacity-90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Knowledge
        </Button>
      </div>
    </div>
  );
}

function ChipEditor({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="gap-1">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <Input
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value.trim()) {
            e.preventDefault();
            onChange([...values, e.currentTarget.value.trim()]);
            e.currentTarget.value = "";
          }
        }}
      />
    </div>
  );
}