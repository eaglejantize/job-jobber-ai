import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        shouldCreateUser: true,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't send login link", description: error.message, variant: "destructive" });
      return;
    }
    setSentTo(trimmed);
  }

  return (
    <Layout>
      <section className="container py-20">
        <div className="max-w-md mx-auto rounded-2xl border border-border bg-card p-8 shadow-card-soft">
          {sentTo ? (
            <div className="text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a one-tap login link to <span className="font-medium text-foreground">{sentTo}</span>.
                Open it on this device to sign in.
              </p>
              <button
                type="button"
                className="mt-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setSentTo(null)}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Sign in</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your email and we'll send you a one-tap login link. No password needed.
              </p>
              <form className="mt-6 space-y-4" onSubmit={submit}>
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
                  {loading ? "Sending…" : "Email me a login link"}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}