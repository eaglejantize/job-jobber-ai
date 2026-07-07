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
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { resetWizardForNewOwner } from "@/lib/wizardSchema";
import { toast } from "@/hooks/use-toast";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { INDUSTRIES, INDUSTRY_VALUES, industryLabel } from "@/lib/industries";

const schema = z
  .object({
    owner_name: z.string().trim().min(1, "Required").max(120),
    business_name: z.string().trim().min(1, "Required").max(160),
    industry: z.enum(INDUSTRY_VALUES, { errorMap: () => ({ message: "Select your industry" }) }),
    email: z.string().trim().email("Enter a valid email").max(160),
    alert_phone: z.string().trim().min(7, "Enter a phone number").max(30),
    password: z.string().min(8, "At least 8 characters").max(72),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

type Prefill = Partial<z.infer<typeof schema>>;

export default function Start() {
  const location = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const prefill = (location.state as { prefill?: Prefill } | null)?.prefill ?? {};
  const canceled = params.get("canceled") === "1";
  const isStripeReturn =
    !!params.get("session_id") ||
    !!params.get("checkout_session_id") ||
    params.get("success") === "1" ||
    params.get("success") === "true";

  const [owner_name, setOwner] = useState(prefill.owner_name ?? "");
  const [business_name, setBiz] = useState(prefill.business_name ?? "");
  const [industry, setIndustry] = useState<string>(prefill.industry ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [alert_phone, setPhone] = useState(prefill.alert_phone ?? "");
  const [password, setPassword] = useState("");
  const [confirm_password, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [emailTaken, setEmailTaken] = useState(false);

  useEffect(() => {
    if (!cooldownUntil) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(left);
      if (left <= 0) setCooldownUntil(null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  useEffect(() => {
    if (canceled) {
      toast({ title: "Checkout canceled", description: "No worries — start again whenever you're ready." });
    }
  }, [canceled]);

  useEffect(() => {
    if (!isStripeReturn) return;
    const t = setTimeout(() => {
      navigate(`/home${location.search}`, { replace: true });
    }, 2000);
    return () => clearTimeout(t);
  }, [isStripeReturn, navigate, location.search]);

  if (isStripeReturn) {
    return (
      <Layout>
        <section className="container py-24 text-center">
          <h1 className="text-2xl font-semibold">Redirecting to dashboard…</h1>
          <p className="mt-3 text-muted-foreground">One moment while we take you to the next step.</p>
        </section>
      </Layout>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldownUntil && Date.now() < cooldownUntil) return;
    const parsed = schema.safeParse({ owner_name, business_name, industry, email, alert_phone, password, confirm_password });
    if (!parsed.success) {
      const f: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { f[i.path[0] as string] = i.message; });
      setErrors(f);
      return;
    }
    setErrors({});
    setEmailTaken(false);
    setSubmitting(true);
    try {
      const data = parsed.data;

      const host = typeof window !== "undefined" ? window.location.hostname : "";
      const isDevHost =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".lovable.app") ||
        host.endsWith(".lovable.dev");

      // 1. Tenant creation via service-role edge function (handles auth user +
      //    callcapture_clients insert under one transaction, bypassing RLS safely).
      const { data: signupRes, error: signupErr } = await supabase.functions.invoke(
        "signup-tenant",
        {
          body: {
            owner_name: data.owner_name,
            business_name: data.business_name,
            email: data.email,
            alert_phone: data.alert_phone,
            password: data.password,
            industry: data.industry,
            dev_bypass: isDevHost,
          },
        },
      );
      const ctx = (signupRes ?? {}) as {
        client_id?: string;
        error?: string;
        message?: string;
        bypass_billing?: boolean;
      };
      if (signupErr || !ctx.client_id) {
        if (ctx.error === "validation_failed") {
          setSubmitting(false);
          toast({ title: "Please check your details", description: "Some fields are missing or invalid.", variant: "destructive" });
          return;
        }
        console.error("signup_failed", { signupErr, ctx });
        const detail =
          ctx.message ||
          ctx.error ||
          signupErr?.message ||
          "Could not create account";
        throw new Error(detail);
      }
      const clientId = ctx.client_id;

      // 2. Sign in so the dashboard has a session when Stripe redirects back.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInErr) console.warn("signin_after_signup_failed", signInErr.message);

      // Wipe any wizard state from a prior account in this browser so the new
      // subaccount starts onboarding with completely blank fields.
      resetWizardForNewOwner();

      // 2b. Billing bypass — skip Stripe and go straight to the dashboard.
      if (ctx.bypass_billing) {
        toast({
          title: "Trial activated",
          description: "30 days free — no payment required.",
        });
        navigate("/home", { replace: true });
        return;
      }

      // 3. Stripe checkout.
      const { data: checkout, error: fnErr } = await supabase.functions.invoke("create-checkout", {
        body: { client_id: clientId },
      });
      if (fnErr || !checkout?.url) throw fnErr ?? new Error("Could not start checkout");

      window.location.href = checkout.url as string;
    } catch (err) {
      setSubmitting(false);
      const message = (err as Error).message ?? "Unknown error";
      console.error("signup_exception", err);
      const rateLimited = /rate limit|after \d+ seconds/i.test(message);
      if (rateLimited) {
        setCooldownUntil(Date.now() + 50_000);
      }
      toast({
        title: "Couldn't create account",
        description: message,
        variant: "destructive",
      });
    }
  }

  return (
    <Layout>
      <section className="bg-hero">
        <div className="container py-16 md:py-20 text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
            Get Started
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            We set this up for you. Live in 24 hours.
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            No tech skills required. Tell us where to send leads, then pay and we begin setup.
          </p>
        </div>
      </section>

      <section className="container pb-20 -mt-6">
        <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start max-w-4xl mx-auto">
          <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card-soft space-y-4">
            <Field label="Your name" error={errors.owner_name}>
              <Input value={owner_name} onChange={(e) => setOwner(e.target.value)} autoComplete="name" required />
            </Field>
            <Field label="Business name" error={errors.business_name}>
              <Input value={business_name} onChange={(e) => setBiz(e.target.value)} autoComplete="organization" required />
            </Field>
            <Field label="Your industry" error={errors.industry}>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              {emailTaken && (
                <p className="text-xs">
                  <Link to={`/auth?email=${encodeURIComponent(email)}`} className="font-medium text-primary hover:underline">
                    Sign in instead →
                  </Link>
                </p>
              )}
            </Field>
            <Field label="Password" error={errors.password}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field label="Confirm password" error={errors.confirm_password}>
              <Input
                type="password"
                value={confirm_password}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <Field label="Mobile number for lead alerts" error={errors.alert_phone}>
              <Input type="tel" value={alert_phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
            </Field>
            <Button
              type="submit"
              disabled={submitting || cooldownLeft > 0}
              size="lg"
              className="w-full bg-cta hover:opacity-90 shadow-glow h-12"
            >
              {cooldownLeft > 0
                ? `Please wait ${cooldownLeft}s…`
                : submitting
                ? "Starting checkout…"
                : "Continue to Setup & Payment"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Secure payment via Stripe. $99 one-time setup, then $197/month.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-foreground hover:underline">
                Sign in
              </Link>
            </p>
          </form>

          <aside className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-4">
            <h3 className="font-semibold">Vektuor Pro</h3>
            <p className="text-xs text-muted-foreground">
              Built for {industryLabel(industry) ?? "service businesses"}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> $99 one-time setup</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> $197/month after</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> We set this up for you</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Live in 24 hours</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> No tech skills required</li>
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
