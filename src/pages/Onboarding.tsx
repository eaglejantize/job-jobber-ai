import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { INDUSTRIES } from "@/lib/industries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Phone, Search, Sparkles, X } from "lucide-react";
import { saveWizardState, loadWizardState } from "@/lib/wizardSchema";

type Suggestion = { industry_label?: string; industry_value?: string; greeting: string; intakeQuestions: string[] };

const labelForValue = (v: string) => INDUSTRIES.find((i) => i.value === v)?.label ?? v;
const valueForLabel = (l: string) => INDUSTRIES.find((i) => i.label === l)?.value;

export default function Onboarding() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<"phone" | "loading" | "review">("phone");
  const [found, setFound] = useState<boolean | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [hours, setHours] = useState("");
  const [industry, setIndustry] = useState<string>("");
  const [greeting, setGreeting] = useState("");
  const [intake, setIntake] = useState<string[]>([]);
  const [newQ, setNewQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Skip onboarding if a row already has a business_name.
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("callcapture_clients")
        .select("business_name")
        .eq("user_id", u.user.id)
        .not("business_name", "is", null)
        .limit(1)
        .maybeSingle();
      if (data?.business_name) navigate("/dashboard", { replace: true });
    })();
  }, [navigate]);

  async function runLookup() {
    if (!phone.trim()) return;
    setStage("loading");
    try {
      const { data, error } = await supabase.functions.invoke("business-lookup", {
        body: { phone },
      });
      if (error) throw error;
      const biz = data?.business;
      const sugg: Suggestion | null = data?.suggestion ?? null;
      setFound(Boolean(data?.found));
      setBusinessName(biz?.business_name ?? "");
      setAddress(biz?.address ?? "");
      setWebsite(biz?.website ?? "");
      setHours(biz?.business_hours ?? "Mon–Fri 8am–6pm");
      if (sugg?.industry_value) setIndustry(sugg.industry_value);
      else if (sugg?.industry_label) setIndustry(valueForLabel(sugg.industry_label) ?? "");
      setGreeting(sugg?.greeting ?? "");
      setIntake(sugg?.intakeQuestions ?? []);
      setStage("review");
      if (!data?.found) {
        toast({
          title: "No business found",
          description: "Fill in your details below — we'll generate a greeting once you pick an industry.",
        });
      }
    } catch (e: any) {
      toast({ title: "Lookup failed", description: e?.message ?? String(e), variant: "destructive" });
      setFound(false);
      setStage("review");
    }
  }

  async function regenerate() {
    if (!businessName.trim() || !industry) {
      toast({ title: "Need name + industry", description: "Fill business name and industry first." });
      return;
    }
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-greeting", {
        body: { businessName, industry: labelForValue(industry) },
      });
      if (error) throw error;
      if (data?.greeting) setGreeting(data.greeting);
      if (Array.isArray(data?.intakeQuestions) && data.intakeQuestions.length) setIntake(data.intakeQuestions);
    } catch (e: any) {
      toast({ title: "Couldn't generate", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  }

  function addQ() {
    const v = newQ.trim();
    if (!v) return;
    setIntake((arr) => [...arr, v]);
    setNewQ("");
  }

  function syncWizardLocal() {
    const prev = loadWizardState();
    saveWizardState({
      ...prev,
      businessName,
      industry,
      businessHours: hours,
      businessPhone: phone,
      greeting: greeting || prev.greeting,
      intakeQuestions: intake.length ? intake : prev.intakeQuestions,
    });
  }

  async function save() {
    if (!businessName.trim() || !industry) {
      toast({ title: "Missing info", description: "Business name and industry are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      const { data: existing } = await supabase
        .from("callcapture_clients")
        .select("id")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const payload: any = {
        user_id: u.user.id,
        email: u.user.email,
        business_name: businessName,
        industry,
        address: address || null,
        website: website || null,
        business_phone: phone || null,
        greeting: greeting || null,
        intake_questions: intake,
        setup_status: "in_progress",
      };

      let err;
      if (existing?.id) {
        ({ error: err } = await supabase.from("callcapture_clients").update(payload).eq("id", existing.id));
      } else {
        ({ error: err } = await supabase.from("callcapture_clients").insert(payload));
      }
      if (err) throw err;

      syncWizardLocal();
      toast({ title: "Saved", description: "Finish phone setup and launch in the wizard." });
      navigate("/setup");
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function useFullWizard() {
    syncWizardLocal();
    navigate("/setup");
  }

  return (
    <Layout>
      <div className="container max-w-2xl py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Set up in under 2 minutes</h1>
          <p className="text-muted-foreground">
            Enter your business phone number and we'll pre-fill the rest.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" /> Business phone number
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runLookup()}
                disabled={stage === "loading"}
              />
              <Button onClick={runLookup} disabled={stage === "loading" || !phone.trim()}>
                {stage === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Look up</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We use Google Places to find your business. If nothing matches you can fill it in by hand below.
            </p>
          </CardContent>
        </Card>

        {stage === "loading" && (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        )}

        {stage === "review" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {found ? "Review and edit" : "Tell us about your business"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Business name</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
                </div>
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((i) => (
                        <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Business hours</Label>
                  <Textarea rows={3} value={hours} onChange={(e) => setHours(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Suggested greeting
                  </Label>
                  <Button type="button" size="sm" variant="ghost" onClick={regenerate} disabled={regenerating}>
                    {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Regenerate"}
                  </Button>
                </div>
                <Textarea rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Thanks for calling — how can I help?" />
              </div>

              <div className="space-y-2">
                <Label>Intake questions</Label>
                <div className="flex flex-wrap gap-2">
                  {intake.map((q, i) => (
                    <Badge key={`${q}-${i}`} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                      {q}
                      <button
                        type="button"
                        className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5"
                        onClick={() => setIntake((arr) => arr.filter((_, idx) => idx !== i))}
                        aria-label={`Remove ${q}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {intake.length === 0 && (
                    <p className="text-xs text-muted-foreground">None yet — pick an industry and regenerate.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a question…"
                    value={newQ}
                    onChange={(e) => setNewQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQ())}
                  />
                  <Button type="button" variant="outline" onClick={addQ}>Add</Button>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
                <Button variant="ghost" onClick={useFullWizard}>Use full wizard instead</Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save & continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}