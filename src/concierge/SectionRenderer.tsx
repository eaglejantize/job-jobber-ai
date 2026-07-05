import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X, ExternalLink, Globe, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import IndustryCombobox from "@/settings/IndustryCombobox";
import VoicePicker from "@/components/VoicePicker";
import { TestCallButton } from "@/components/TestCallButton";
import ActionBar from "./ActionBar";
import type { UseConcierge } from "./useConcierge";
import PhoneNumberSection from "./PhoneNumberSection";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getValue(ctx: UseConcierge, key: string) {
  if (key in ctx.pending) return (ctx.pending as any)[key];
  return (ctx.current as any)?.[key];
}

function Suggested() {
  return (
    <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wide">
      Suggested
    </Badge>
  );
}

function isPending(ctx: UseConcierge, key: string) {
  return key in ctx.pending;
}

export default function SectionRenderer({
  sectionId,
  ctx,
}: {
  sectionId: string;
  ctx: UseConcierge;
}) {
  const set = ctx.setField;
  const disableGbp = !ctx.current?.address && !ctx.current?.website;

  // AI Receptionist combines several legacy sub-sections into one step.
  if (sectionId === "ai_receptionist") {
    return (
      <div className="space-y-8">
        <SectionRenderer sectionId="ai_personality" ctx={ctx} />
        <SectionRenderer sectionId="voice" ctx={ctx} />
        <SectionRenderer sectionId="greeting" ctx={ctx} />
        <SectionRenderer sectionId="after_hours" ctx={ctx} />
        <SectionRenderer sectionId="call_forwarding" ctx={ctx} />
        <SectionRenderer sectionId="voicemail" ctx={ctx} />
        <SectionRenderer sectionId="sms_followup" ctx={ctx} />
        <SectionRenderer sectionId="rings_before_ai" ctx={ctx} />
      </div>
    );
  }

  if (sectionId === "integrations") {
    return <IntegrationsSection ctx={ctx} />;
  }

  if (sectionId === "phone_number") {
    return <PhoneNumberSection ctx={ctx} />;
  }

  switch (sectionId as string) {
    case "business_profile":
      return (
        <div className="space-y-4">
          <GoogleBusinessSection ctx={ctx} />
          {[
            ["business_name", "Business name"],
            ["business_phone", "Business phone"],
            ["business_email", "Business email"],
            ["address", "Address"],
            ["website", "Website"],
          ].map(([k, l]) => (
            <div key={k}>
              <Label>
                {l}
                {isPending(ctx, k) && <Suggested />}
              </Label>
              <Input
                value={String(getValue(ctx, k) ?? "")}
                onChange={(e) => set(k, e.target.value)}
                placeholder={l}
              />
            </div>
          ))}
        </div>
      );

    case "industry":
      return (
        <div className="space-y-2">
          <Label>Industry{isPending(ctx, "industry") && <Suggested />}</Label>
          <IndustryCombobox
            value={String(getValue(ctx, "industry") ?? "")}
            onChange={(industry, group) => {
              set("industry", industry);
              set("business_category_group", group);
            }}
          />
        </div>
      );

    case "website_import":
      return <WebsiteImportSection ctx={ctx} />;

    case "ai_personality": {
      const tone = String(getValue(ctx, "tone") ?? "Friendly");
      const persona = String(getValue(ctx, "ai_personality") ?? "");
      return (
        <div className="space-y-3">
          <div>
            <Label>Tone{isPending(ctx, "tone") && <Suggested />}</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {["Professional", "Friendly", "Energetic", "Calm", "Concierge"].map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={tone === t ? "default" : "outline"}
                  onClick={() => set("tone", t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Personality notes{isPending(ctx, "ai_personality") && <Suggested />}</Label>
            <Textarea
              rows={3}
              value={persona}
              onChange={(e) => set("ai_personality", e.target.value)}
              placeholder="E.g. warm, concise, never pushy. Mirror the caller's energy."
            />
          </div>
        </div>
      );
    }

    case "voice": {
      const voiceId = String(getValue(ctx, "voice_id") ?? "");
      return (
        <div className="space-y-3">
          <Label>Voice{isPending(ctx, "voice_id") && <Suggested />}</Label>
          <VoicePicker
            value={voiceId}
            onChange={(v) => {
              set("voice_id", v.id);
              set("voice_label", v.label);
            }}
          />
        </div>
      );
    }

    case "hours_routing": {
      const mode = String(getValue(ctx, "phone_mode") ?? "ai_first");
      const forwardFirst = !!getValue(ctx, "forward_first");
      const rings = Number(getValue(ctx, "rings_before_answer") ?? 2);
      return (
        <div className="space-y-4">
          <div>
            <Label>How should calls be routed?</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                ["ai_first", "AI answers first"],
                ["forward_first", "Try forwarding first"],
                ["ai_only", "AI only"],
              ].map(([v, l]) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={mode === v ? "default" : "outline"}
                  onClick={() => {
                    set("phone_mode", v);
                    set("forward_first", v === "forward_first");
                  }}
                >
                  {l}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={forwardFirst}
              onCheckedChange={(v) => set("forward_first", v)}
            />
            <Label>Try forwarding to your team before AI picks up</Label>
          </div>
          <div>
            <Label>Rings before AI answers</Label>
            <Input
              type="number"
              min={1}
              max={6}
              value={rings}
              onChange={(e) => set("rings_before_answer", Number(e.target.value))}
            />
          </div>
        </div>
      );
    }

    case "call_forwarding": {
      const v = String(getValue(ctx, "forward_phone") ?? "");
      return (
        <div className="space-y-2">
          <Label>Forward-to phone (E.164){isPending(ctx, "forward_phone") && <Suggested />}</Label>
          <Input
            value={v}
            onChange={(e) => set("forward_phone", e.target.value)}
            placeholder="+15551234567"
          />
          <p className="text-xs text-muted-foreground">
            When the AI transfers a call, it will dial this number.
          </p>
        </div>
      );
    }

    case "voicemail": {
      const enabled = !!getValue(ctx, "voicemail_enabled");
      const fallback = !!getValue(ctx, "voicemail_fallback");
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={(v) => set("voicemail_enabled", v)} />
            <Label>Voicemail enabled</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={fallback} onCheckedChange={(v) => set("voicemail_fallback", v)} />
            <Label>Fall back to voicemail if AI can't handle</Label>
          </div>
        </div>
      );
    }

    case "calendar": {
      const calId = String(getValue(ctx, "google_calendar_id") ?? "");
      const connectedAt = (ctx.current as any)?.google_calendar_connected_at;
      return (
        <div className="space-y-3">
          {connectedAt ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              Google Calendar is connected.
              {calId && <div className="text-xs text-muted-foreground mt-1">Calendar: {calId}</div>}
            </div>
          ) : (
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
              Calendar isn't connected yet. Connect it from the Integrations tab.
            </div>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/settings?tab=integrations#calendar">
              <ExternalLink className="h-4 w-4" /> Open Calendar Integration
            </Link>
          </Button>
        </div>
      );
    }

    case "knowledge": {
      const v = String(getValue(ctx, "knowledge_base") ?? "");
      return (
        <div className="space-y-3">
          <Label>Knowledge base{isPending(ctx, "knowledge_base") && <Suggested />}</Label>
          <Textarea
            rows={8}
            value={v}
            onChange={(e) => set("knowledge_base", e.target.value)}
            placeholder="Pricing details, service guarantees, brands you carry, anything callers ask about."
          />
          <ActionBar
            section="policies"
            currentValue={v}
            disableGbp={disableGbp}
            onResult={(val) => typeof val === "string" && set("knowledge_base", val)}
          />
        </div>
      );
    }

    case "test_call":
      return <TestCallSection ctx={ctx} />;

    case "services": {
      const list = (getValue(ctx, "services") as string[] | null) ?? [];
      return (
        <div className="space-y-3">
          <Label>Services{isPending(ctx, "services") && <Suggested />}</Label>
          <div className="space-y-2">
            {list.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={s}
                  onChange={(e) => {
                    const next = [...list];
                    next[i] = e.target.value;
                    set("services", next);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => set("services", list.filter((_, j) => j !== i))}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => set("services", [...list, ""])}
              type="button"
            >
              <Plus className="h-4 w-4" /> Add service
            </Button>
          </div>
          <ActionBar
            section="services"
            currentValue={list}
            disableGbp={disableGbp}
            onResult={(v) => Array.isArray(v) && set("services", v)}
          />
        </div>
      );
    }

    case "hours": {
      const open247 = !!getValue(ctx, "business_hours_24_7");
      const schedule = (getValue(ctx, "business_hours_schedule") as Record<
        string,
        { open: string; close: string; closed: boolean }
      > | null) ?? {};
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={open247}
              onCheckedChange={(v) => set("business_hours_24_7", v)}
            />
            <Label>Open 24/7</Label>
            {isPending(ctx, "business_hours_24_7") && <Suggested />}
          </div>
          {!open247 && (
            <div className="space-y-2">
              {DAYS.map((d) => {
                const row = schedule[d] ?? { open: "09:00", close: "17:00", closed: false };
                return (
                  <div key={d} className="grid grid-cols-[110px_auto_auto_auto] items-center gap-2">
                    <span className="text-sm">{d}</span>
                    <Switch
                      checked={!row.closed}
                      onCheckedChange={(v) =>
                        set("business_hours_schedule", {
                          ...schedule,
                          [d]: { ...row, closed: !v },
                        })
                      }
                    />
                    <Input
                      type="time"
                      value={row.open}
                      disabled={row.closed}
                      onChange={(e) =>
                        set("business_hours_schedule", {
                          ...schedule,
                          [d]: { ...row, open: e.target.value },
                        })
                      }
                    />
                    <Input
                      type="time"
                      value={row.close}
                      disabled={row.closed}
                      onChange={(e) =>
                        set("business_hours_schedule", {
                          ...schedule,
                          [d]: { ...row, close: e.target.value },
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    case "service_area": {
      const sa = (getValue(ctx, "service_area") as {
        cities?: string[];
        zips?: string[];
        radius_miles?: number;
      } | null) ?? {};
      return (
        <div className="space-y-3">
          <div>
            <Label>Cities (comma-separated){isPending(ctx, "service_area") && <Suggested />}</Label>
            <Input
              value={(sa.cities ?? []).join(", ")}
              onChange={(e) =>
                set("service_area", {
                  ...sa,
                  cities: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div>
            <Label>ZIP codes (comma-separated)</Label>
            <Input
              value={(sa.zips ?? []).join(", ")}
              onChange={(e) =>
                set("service_area", {
                  ...sa,
                  zips: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div>
            <Label>Radius (miles)</Label>
            <Input
              type="number"
              value={sa.radius_miles ?? ""}
              onChange={(e) =>
                set("service_area", {
                  ...sa,
                  radius_miles: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <ActionBar
            section="service_area"
            currentValue={sa}
            disableGbp={disableGbp}
            onResult={(v) => v && typeof v === "object" && set("service_area", v)}
          />
        </div>
      );
    }

    case "emergency": {
      const enabled = !!getValue(ctx, "emergency_services");
      const rules = (getValue(ctx, "emergency_rules") as { notes?: string } | null) ?? {};
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              onCheckedChange={(v) => set("emergency_services", v)}
            />
            <Label>We offer emergency service</Label>
            {isPending(ctx, "emergency_services") && <Suggested />}
          </div>
          {enabled && (
            <div>
              <Label>Emergency rules / notes{isPending(ctx, "emergency_rules") && <Suggested />}</Label>
              <Textarea
                rows={4}
                value={rules.notes ?? ""}
                onChange={(e) => set("emergency_rules", { ...rules, notes: e.target.value })}
                placeholder="When do you accept emergencies? Are there extra fees? Hours?"
              />
            </div>
          )}
          <ActionBar
            section="emergency"
            currentValue={{ enabled, notes: rules.notes ?? "" }}
            disableGbp={disableGbp}
            onResult={(v) => {
              if (v && typeof v === "object") {
                const o = v as { enabled?: boolean; notes?: string };
                if (typeof o.enabled === "boolean") set("emergency_services", o.enabled);
                if (typeof o.notes === "string") set("emergency_rules", { ...rules, notes: o.notes });
              }
            }}
          />
        </div>
      );
    }

    case "scheduling": {
      const enabled = !!getValue(ctx, "scheduling_enabled");
      const mode = String(getValue(ctx, "scheduling_mode") ?? "intake_only");
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              onCheckedChange={(v) => set("scheduling_enabled", v)}
            />
            <Label>Let the AI handle scheduling</Label>
          </div>
          {enabled && (
            <div className="space-y-2">
              <Label>Mode</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  ["intake_only", "Capture intake only"],
                  ["book_calendar", "Book on my calendar"],
                  ["transfer_to_office", "Transfer to office"],
                ].map(([v, l]) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={mode === v ? "default" : "outline"}
                    onClick={() => set("scheduling_mode", v)}
                  >
                    {l}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    case "fee": {
      const v = getValue(ctx, "diagnostic_fee");
      return (
        <div>
          <Label>Diagnostic / service fee (USD){isPending(ctx, "diagnostic_fee") && <Suggested />}</Label>
          <Input
            type="number"
            value={v ?? ""}
            onChange={(e) => set("diagnostic_fee", e.target.value ? Number(e.target.value) : null)}
            placeholder="89"
          />
        </div>
      );
    }

    case "greeting": {
      const v = String(getValue(ctx, "greeting") ?? "");
      return (
        <div className="space-y-3">
          <Label>First message{isPending(ctx, "greeting") && <Suggested />}</Label>
          <Textarea
            rows={3}
            value={v}
            onChange={(e) => set("greeting", e.target.value)}
            placeholder="Thanks for calling Acme Plumbing, how can I help?"
          />
          <ActionBar
            section="greeting"
            currentValue={v}
            disableGbp={disableGbp}
            onResult={(val) => typeof val === "string" && set("greeting", val)}
          />
        </div>
      );
    }

    case "after_hours": {
      const v = String(getValue(ctx, "after_hours_message") ?? "");
      return (
        <div className="space-y-3">
          <Label>After-hours message{isPending(ctx, "after_hours_message") && <Suggested />}</Label>
          <Textarea
            rows={3}
            value={v}
            onChange={(e) => set("after_hours_message", e.target.value)}
          />
          <ActionBar
            section="after_hours"
            currentValue={v}
            disableGbp={disableGbp}
            onResult={(val) => typeof val === "string" && set("after_hours_message", val)}
          />
        </div>
      );
    }

    case "sms_followup": {
      const v = String(getValue(ctx, "sms_followup_template") ?? "");
      return (
        <div className="space-y-3">
          <Label>SMS follow-up template{isPending(ctx, "sms_followup_template") && <Suggested />}</Label>
          <Textarea
            rows={3}
            value={v}
            onChange={(e) => set("sms_followup_template", e.target.value)}
            placeholder="Hi {{name}}, thanks for calling Acme. We'll be in touch shortly!"
          />
          <p className="text-xs text-muted-foreground">
            You can use placeholders like <code>{"{{name}}"}</code>.
          </p>
          <ActionBar
            section="sms_followup"
            currentValue={v}
            disableGbp={disableGbp}
            onResult={(val) => typeof val === "string" && set("sms_followup_template", val)}
          />
        </div>
      );
    }

    case "faqs": {
      const list = (getValue(ctx, "faqs") as Array<{ q: string; a: string }> | null) ?? [];
      return (
        <div className="space-y-3">
          <Label>FAQs{isPending(ctx, "faqs") && <Suggested />}</Label>
          {list.map((f, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <Input
                placeholder="Question"
                value={f.q}
                onChange={(e) => {
                  const next = [...list];
                  next[i] = { ...f, q: e.target.value };
                  set("faqs", next);
                }}
              />
              <Textarea
                rows={2}
                placeholder="Answer"
                value={f.a}
                onChange={(e) => {
                  const next = [...list];
                  next[i] = { ...f, a: e.target.value };
                  set("faqs", next);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => set("faqs", list.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" /> Remove
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => set("faqs", [...list, { q: "", a: "" }])}
          >
            <Plus className="h-4 w-4" /> Add FAQ
          </Button>
          <ActionBar
            section="faqs"
            currentValue={list}
            disableGbp={disableGbp}
            onResult={(v) => Array.isArray(v) && set("faqs", v)}
          />
        </div>
      );
    }

    case "policies": {
      const v = String(getValue(ctx, "company_policies") ?? "");
      return (
        <div className="space-y-3">
          <Label>Company policies{isPending(ctx, "company_policies") && <Suggested />}</Label>
          <Textarea
            rows={6}
            value={v}
            onChange={(e) => set("company_policies", e.target.value)}
            placeholder="Cancellation, payments, guarantees, etc."
          />
          <ActionBar
            section="policies"
            currentValue={v}
            disableGbp={disableGbp}
            onResult={(val) => typeof val === "string" && set("company_policies", val)}
          />
        </div>
      );
    }

    default:
      return null;
  }
}

function GoogleBusinessSection({ ctx }: { ctx: UseConcierge }) {
  const [loading, setLoading] = useState(false);
  const name = String((ctx.current as any)?.business_name ?? "");
  const address = String((ctx.current as any)?.address ?? "");
  const website = String((ctx.current as any)?.website ?? "");

  async function importFromGoogle() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("business-lookup", {
        body: { name, address, website },
      });
      if (error) throw error;
      const b = (data as any)?.business;
      if (b) {
        if (b.business_name) ctx.setField("business_name", b.business_name);
        if (b.address) ctx.setField("address", b.address);
        if (b.website) ctx.setField("website", b.website);
        if (b.phone) ctx.setField("business_phone", b.phone);
        if (b.place_id) ctx.setField("google_place_id", b.place_id);
      }
      toast({ title: "Imported from Google" });
    } catch (e) {
      toast({
        title: "Couldn't reach Google",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        We'll look up your business on Google and pull verified name, address, phone,
        and website.
      </p>
      <Button onClick={importFromGoogle} disabled={loading || (!name && !address && !website)} type="button">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
        Import from Google
      </Button>
    </div>
  );
}

function WebsiteImportSection({ ctx }: { ctx: UseConcierge }) {
  const [loading, setLoading] = useState(false);
  const website = String(ctx.pending.website ?? (ctx.current as any)?.website ?? "");

  async function importFromWebsite() {
    if (!website) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-prefill-setup", {
        body: { website },
      });
      if (error) throw error;
      const out = (data as any) ?? {};
      const map: Record<string, string> = {
        business_name: "business_name",
        industry: "industry",
        greeting: "greeting",
        services: "services",
        faqs: "faqs",
        knowledge_base: "knowledge_base",
      };
      for (const [k, dest] of Object.entries(map)) {
        if (out[k] != null && out[k] !== "") ctx.setField(dest, out[k]);
      }
      toast({ title: "Website imported" });
    } catch (e) {
      toast({
        title: "Couldn't read site",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Label>Website URL</Label>
      <Input
        value={website}
        onChange={(e) => ctx.setField("website", e.target.value)}
        placeholder="https://acmeplumbing.com"
      />
      <Button onClick={importFromWebsite} disabled={loading || !website} type="button">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
        Read site and prefill
      </Button>
    </div>
  );
}

function TestCallSection({ ctx }: { ctx: UseConcierge }) {
  const passedAt = (ctx.current as any)?.test_call_passed_at;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Place a real outbound call from your AI receptionist. Once the call connects and lasts a few seconds, this step completes automatically.
      </p>
      <div className="flex flex-wrap gap-2">
        <TestCallButton clientId={ctx.clientId ?? undefined} />
      </div>
      {passedAt && (
        <div className="text-xs text-emerald-600">
          Last successful test: {new Date(passedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function IntegrationsSection({ ctx }: { ctx: UseConcierge }) {
  const [calendarId, setCalendarId] = useState<string>(
    String((ctx.current as any)?.google_calendar_id ?? "primary"),
  );
  const [busy, setBusy] = useState(false);
  const connectedAt = (ctx.current as any)?.google_calendar_connected_at;

  async function connect() {
    if (!ctx.clientId) return;
    setBusy(true);
    const { error } = await supabase
      .from("callcapture_clients")
      .update({
        google_calendar_id: calendarId.trim() || "primary",
        google_calendar_connected_at: new Date().toISOString(),
      } as never)
      .eq("id", ctx.clientId);
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't connect", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Google Calendar connected" });
      await ctx.reload();
    }
  }

  async function disconnect() {
    if (!ctx.clientId) return;
    await supabase
      .from("callcapture_clients")
      .update({ google_calendar_connected_at: null } as never)
      .eq("id", ctx.clientId);
    await ctx.reload();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect the integrations you use. Skip any you don't — you can come back to
        this step anytime.
      </p>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold">Google Calendar</div>
            <div className="text-xs text-muted-foreground">
              Let the AI book real appointments on your calendar.
            </div>
          </div>
          {connectedAt ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <div>
            <Label className="text-xs">Calendar ID</Label>
            <Input
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              placeholder="primary or you@domain.com"
            />
          </div>
          <div className="flex items-end">
            {connectedAt ? (
              <Button variant="outline" onClick={disconnect} type="button">
                Disconnect
              </Button>
            ) : (
              <Button onClick={connect} disabled={busy} type="button">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        More integrations (Outlook, QuickBooks, Housecall Pro, ServiceTitan, Zapier)
        coming soon.
      </div>
    </div>
  );
}