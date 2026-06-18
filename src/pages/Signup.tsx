import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

const INDUSTRIES = [
  "Appliance Repair",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Law Firm",
  "Med Spa",
  "General Contractor",
  "Other",
] as const;

const schema = z
  .object({
    business_name: z.string().trim().min(1, "Required").max(160),
    industry: z.enum(INDUSTRIES, { errorMap: () => ({ message: "Select an industry" }) }),
    email: z.string().trim().email("Enter a valid email").max(160),
    password: z.string().min(8, "At least 8 characters").max(72),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

// $99/month — free setup (limited time)
const MONTHLY_PRICE_CENTS = 9900;

export default function Signup() {
  const [business_name, setBiz] = useState("");
  const [industry, setIndustry] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm_password, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function waitForSession(): Promise<string | null> {
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) return token;
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ business_name, industry, email, password, confirm_password });
    if (!parsed.success) {
      const f: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { f[i.path[0] as string] = i.message; });
      setErrors(f);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const d = parsed.data;
      const { error: signUpErr } = await supabase.auth.signUp({
        email: d.email,
        password: d.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { business_name: d.business_name, industry: d.industry },
        },
      });
      if (signUpErr) {
        const msg = signUpErr.message ?? "";
        const exists = /registered|already|exists/i.test(msg);
        toast({
          title: exists ? "Account already exists" : "Couldn't create account",
          description: exists
            ? `An account already exists for ${d.email}. Use a different email for a separate sub-account, or sign in.`
            : msg,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Poll for session (email confirm disabled = session arrives immediately).
      const token = await waitForSession();
      if (!token) {
        toast({
          title: "Confirm your email",
          description: "We sent you a confirmation link. Open it, then return to complete checkout.",
        });
        setSubmitting(false);
        return;
      }

      // Call create-checkout with Bearer token and signup payload.
      const res = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "signup",
          business_name: d.business_name,
          industry: d.industry,
          monthly_amount_cents: MONTHLY_PRICE_CENTS,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.error || !res.data?.url) {
        throw res.error ?? new Error("Could not start checkout");
      }
      window.location.href = res.data.url as string;
    } catch (err) {
      setSubmitting(false);
      toast({
        title: "Checkout failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  }

  return (
    <Layout>
      <section className="bg-hero">
        <div className="container py-16 md:py-20 text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
            Create your account
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Start capturing every call
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            $99/month · Free setup (limited time)
          </p>
        </div>
      </section>

      <section className="container pb-20 -mt-6">
        <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start max-w-4xl mx-auto">
          <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card-soft space-y-4">
            <Field label="Business name" error={errors.business_name}>
              <Input value={business_name} onChange={(e) => setBiz(e.target.value)} autoComplete="organization" required />
            </Field>
            <Field label="Industry" error={errors.industry}>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue placeholder="Select your industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </Field>
            <Field label="Password" error={errors.password}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="Confirm password" error={errors.confirm_password}>
              <Input type="password" value={confirm_password} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required />
            </Field>
            <Button
              type="submit"
              disabled={submitting}
              size="lg"
              className="w-full bg-cta hover:opacity-90 shadow-glow h-12"
            >
              {submitting ? "Starting checkout…" : "Create account & continue"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Secure payment via Stripe. Cancel anytime.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-foreground hover:underline">
                Sign in
              </Link>
            </p>
          </form>

          <aside className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-4">
            <h3 className="font-semibold">Vektuor</h3>
            <p className="text-2xl font-bold">$99<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Free setup (limited time)</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> AI receptionist 24/7</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Instant lead alerts</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Cancel anytime</li>
            </ul>
          </aside>
        </div>
      </section>
    </Layout>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label} <span className="text-primary">*</span></Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}