import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

const schema = z
  .object({
    owner_name: z.string().trim().min(1, "Required").max(120),
    business_name: z.string().trim().min(1, "Required").max(160),
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
      navigate(`/dashboard${location.search}`, { replace: true });
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
    const parsed = schema.safeParse({ owner_name, business_name, email, alert_phone, password, confirm_password });
    if (!parsed.success) {
      const f: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        f[i.path[0] as string] = i.message;
      });
      setErrors(f);
      return;
    }
    setErrors({});
    setEmailTaken(false);
    setSubmitting(true);

    try {
      const data = parsed.data;

      // 1. Create auth user
      const signUpRes = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });

      if (signUpRes.error) {
        const raw = signUpRes.error.message ?? "";
        const lower = raw.toLowerCase();
        const status = (signUpRes.error as { status?: number }).status;
        const rateLimited =
          status === 429 ||
          lower.includes("for security purposes") ||
          lower.includes("rate limit") ||
          /after\s+\d+\s*seconds?/.test(lower);
        const alreadyExists = lower.includes("registered") || lower.includes("already") || lower.includes("exists");

        if (rateLimited) {
          const secMatch = lower.match(/after\s+(\d+)\s*seconds?/);
          const secs = secMatch ? parseInt(secMatch[1], 10) : 60;
          setCooldownUntil(Date.now() + secs * 1000);
          setSubmitting(false);
          toast({
            title: `Please wait ${secs}s before trying again`,
            description: "Too many recent attempts. If you already have an account, sign in instead.",
            variant: "destructive",
          });
          return;
        }
        if (alreadyExists) {
          setSubmitting(false);
          setEmailTaken(true);
          setErrors({ email: "This email already has an account. Use a different email for a new sub-account." });
          toast({
            title: "Account already exists",
            description: `Sign in to your existing account or use a different email.`,
            variant: "destructive",
          });
          return;
        }
        setSubmitting(false);
        toast({ title: "Couldn't create account", description: signUpRes.error.message, variant: "destructive" });
        return;
      }

      // Supabase quirk: email confirmation on — already-registered email returns
      // a fake user with empty identities array. Treat as "already exists".
      const identities = signUpRes.data.user?.identities ?? [];
      if (signUpRes.data.user && identities.length === 0) {
        setSubmitting(false);
        setEmailTaken(true);
        setErrors({ email: "This email already has an account. Use a different email for a new sub-account." });
        toast({
          title: "Account already exists",
          description: `Sign in or use a different email.`,
          variant: "destructive",
        });
        return;
      }

      // 2. Get access token — may be null if email confirmation is required
      const accessToken = signUpRes.data.session?.access_token ?? null;

      if (!accessToken) {
        // Email confirmation required — can't call edge function yet
        setSubmitting(false);
        toast({
          title: "Check your email",
          description: "We sent you a confirmation link. Click it to finish setting up your account.",
        });
        return;
      }

      // 3. Call edge function — it handles the DB write and Stripe session
      const { data: checkout, error: fnErr } = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "signup",
          business_name: data.business_name,
          industry: "general",
          owner_name: data.owner_name,
          email: data.email,
          alert_phone: data.alert_phone,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (fnErr || !checkout?.url) {
        throw fnErr ?? new Error("Could not start checkout");
      }

      window.location.href = checkout.url as string;
    } catch (err) {
      setSubmitting(false);
      toast({
        title: "Couldn't start checkout",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  }

  return (
    <Layout>
      <section className="bg-hero">
        <div className="container py-16 md:py-20 text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Get Started</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">We set this up for you. Live in 24 hours.</h1>
          <p className="mt-4 text-muted-foreground text-lg">
            No tech skills required. Tell us where to send leads, then pay and we begin setup.
          </p>
        </div>
      </section>

      <section className="container pb-20 -mt-6">
        <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start max-w-4xl mx-auto">
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card-soft space-y-4"
          >
            <Field label="Your name" error={errors.owner_name}>
              <Input value={owner_name} onChange={(e) => setOwner(e.target.value)} autoComplete="name" required />
            </Field>
            <Field label="Business name" error={errors.business_name}>
              <Input
                value={business_name}
                onChange={(e) => setBiz(e.target.value)}
                autoComplete="organization"
                required
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              {emailTaken && (
                <p className="text-xs">
                  <Link
                    to={`/auth?email=${encodeURIComponent(email)}`}
                    className="font-medium text-primary hover:underline"
                  >
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
              <Input
                type="tel"
                value={alert_phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
              />
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
              Secure payment via Stripe. $99/month — free setup included.
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
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> $99/month
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Free setup (limited time)
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> We set this up for you
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> Live in 24 hours
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> No tech skills required
              </li>
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
      <Label>
        {label} <span className="text-primary">*</span>
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
