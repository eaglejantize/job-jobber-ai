import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { REQUEST_TYPES } from "@/lib/constants";
import { CheckCircle2 } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  business_name: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(160),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  request_type: z.string().min(1, "Pick one"),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export default function Support() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = {
      name: String(form.get("name") || ""),
      business_name: String(form.get("business_name") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      request_type: String(form.get("request_type") || ""),
      message: String(form.get("message") || ""),
    };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("callcapture_support_requests").insert({
      ...parsed.data,
      user_id: userData.user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Couldn't send", description: error.message, variant: "destructive" });
      return;
    }
    setDone(true);
    toast({ title: "We got it.", description: "We'll be in touch within a few hours." });
  }

  return (
    <Layout>
      <section className="bg-hero">
        <div className="container py-16 md:py-20 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            We'll set up your AI receptionist in 24 hours.
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            Fill this out. We'll handle the rest.
          </p>
        </div>
      </section>

      <section className="container pb-20 -mt-6">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card-soft">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold">You're on the list.</h2>
              <p className="mt-2 text-muted-foreground">
                We'll reach out within a few hours to get your AI receptionist live.
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <Field label="Your name" name="name" required error={errors.name} />
              <Field label="Business name" name="business_name" error={errors.business_name} />
              <Field label="Email" name="email" type="email" required error={errors.email} />
              <Field label="Phone" name="phone" type="tel" error={errors.phone} />
              <div className="space-y-2">
                <Label>What do you need help with?</Label>
                <select
                  name="request_type"
                  required
                  defaultValue=""
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>Pick one…</option>
                  {REQUEST_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.request_type && <p className="text-sm text-destructive">{errors.request_type}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Anything else? (optional)</Label>
                <Textarea id="message" name="message" rows={4} placeholder="Tell us about your business and what you'd like the receptionist to do." />
              </div>
              <Button type="submit" disabled={submitting} size="lg" className="w-full bg-cta hover:opacity-90 shadow-glow h-12">
                {submitting ? "Sending…" : "Request Setup Help"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </Layout>
  );
}

function Field({ label, name, type = "text", required, error }: { label: string; name: string; type?: string; required?: boolean; error?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}{required && <span className="text-primary"> *</span>}</Label>
      <Input id={name} name={name} type={type} required={required} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}