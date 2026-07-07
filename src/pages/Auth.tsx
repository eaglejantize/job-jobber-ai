import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const nextParam = params.get("next");
  const nextTarget = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";

  useEffect(() => {
    if (user) navigate(nextTarget, { replace: true });
  }, [user, navigate, nextTarget]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't sign in", description: error.message, variant: "destructive" });
      return;
    }
    navigate(nextTarget);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't send reset email", description: error.message, variant: "destructive" });
      return;
    }
    setResetSentTo(trimmedEmail);
  }

  return (
    <Layout>
      <section className="container py-20">
        <div className="max-w-md mx-auto rounded-2xl border border-border bg-card p-8 shadow-card-soft">
          {resetSentTo ? (
            <div className="text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a password reset link to{" "}
                <span className="font-medium text-foreground">{resetSentTo}</span>.
              </p>
              <button
                type="button"
                className="mt-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => { setResetSentTo(null); setMode("signin"); }}
              >
                Back to sign in
              </button>
            </div>
          ) : mode === "forgot" ? (
            <>
              <h1 className="text-2xl font-bold">Reset password</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your email and we'll send you a link to set a new password.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleForgot}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-cta hover:opacity-90 shadow-glow h-11">
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <button
                  type="button"
                  className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setMode("signin")}
                >
                  Back to sign in
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Sign in</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Welcome back. Enter your email and password.
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-cta hover:opacity-90 shadow-glow h-11">
                  {loading ? "Signing in…" : "Sign In"}
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/start" state={{ prefill: {} }} className="font-medium text-foreground hover:underline">
                    Create account
                  </Link>
                </p>
                <p className="text-xs text-center text-muted-foreground">
                  Need a separate sub-account? Use a different email address when creating it.
                </p>
              </form>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
