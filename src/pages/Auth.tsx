import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const fn = mode === "signin"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
    const { error } = await fn;
    setLoading(false);
    if (error) { toast({ title: "Couldn't sign in", description: error.message, variant: "destructive" }); return; }
    navigate("/dashboard");
  }

  return (
    <Layout>
      <section className="container py-20">
        <div className="max-w-md mx-auto rounded-2xl border border-border bg-card p-8 shadow-card-soft">
          <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in" : "Create your account"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Access your dashboard and saved setup." : "Save your setup and access your dashboard."}
          </p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-cta hover:opacity-90 shadow-glow h-11">
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </Layout>
  );
}