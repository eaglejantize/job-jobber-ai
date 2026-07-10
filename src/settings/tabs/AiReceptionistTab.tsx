import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import VoicePicker from "@/components/VoicePicker";
import { TestCallButton } from "@/components/TestCallButton";
import { VOICES } from "@/lib/voices";
import { UseControlCenterData } from "../useControlCenterData";

export default function AiReceptionistTab({ ctx }: { ctx: UseControlCenterData }) {
  const { data, update, save, saving, clientId } = ctx;
  const [rewriting, setRewriting] = useState(false);
  const [verifyingVoice, setVerifyingVoice] = useState(false);

  async function rewriteGreeting() {
    setRewriting(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("ai-rewrite-greeting", {
        body: {
          business_name: data.business_name,
          industry: data.industry,
          tone: data.tone,
          current: data.greeting,
        },
      });
      if (error) throw error;
      const next = (resp as { greeting?: string })?.greeting;
      if (next) update({ greeting: next });
    } catch (e) {
      toast({ title: "Couldn't rewrite", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRewriting(false);
    }
  }

  async function onSave() {
    const { error } = await save({
      greeting: data.greeting,
      after_hours_message: data.after_hours_message,
      voice_id: data.voice_id,
      voice_label: data.voice_label,
      selected_voice_catalog_id: data.selected_voice_catalog_id,
      voice_provider: data.voice_provider,
      voice_provider_voice_id: data.voice_provider_voice_id,
      voice_sync_status: "pending",
      voice_last_sync_error: null,
      voice_speed: data.voice_speed,
      tone: data.tone,
      language: data.language,
      conversation_style: data.conversation_style,
      ai_personality: data.ai_personality,
      transfer_number: data.transfer_number || data.forward_phone,
      voicemail_enabled: data.voicemail_enabled,
      call_recording_enabled: data.call_recording_enabled,
      call_summary_enabled: data.call_summary_enabled,
      sms_followup_enabled: data.sms_followup_enabled,
      scheduling_enabled: data.scheduling_enabled,
      scheduling_mode: data.scheduling_mode,
      diagnostic_fee: data.diagnostic_fee,
    } as never);
    if (error) toast({ title: "Save failed", description: (error as Error).message, variant: "destructive" });
    else toast({ title: "AI receptionist saved" });
  }

  async function verifyVoiceSync() {
    if (!clientId) return;
    setVerifyingVoice(true);
    try {
      const { data: verifyData, error } = await supabase.functions.invoke("verify-voice-sync", {
        body: { client_id: clientId },
      });
      if (error) throw error;
      const result = (verifyData ?? {}) as { status?: "synced" | "failed" | "pending"; error?: string };
      update({
        voice_sync_status: result.status ?? "pending",
        voice_last_sync_error: result.error ?? null,
      });
      if (result.status === "synced") {
        toast({ title: "Voice sync verified", description: "Preview and live provider voice are aligned." });
      } else {
        toast({ title: "Voice setup needs attention", description: result.error ?? "Voice sync is not verified.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Voice verification failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setVerifyingVoice(false);
    }
  }

  const voiceNeedsAttention = data.voice_sync_status !== "synced" || !!data.voice_last_sync_error;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Greetings</h2>
        <div className="space-y-2">
          <Label>AI Greeting</Label>
          <Textarea rows={3} value={data.greeting || ""} onChange={(e) => update({ greeting: e.target.value })} />
          <Button size="sm" variant="outline" onClick={rewriteGreeting} disabled={rewriting}>
            {rewriting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Rewrite with AI
          </Button>
        </div>
        <div className="space-y-2">
          <Label>After Hours Greeting</Label>
          <Textarea rows={3} value={data.after_hours_message || ""} onChange={(e) => update({ after_hours_message: e.target.value })} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Voice & Style</h2>
        <VoicePicker
          value={String(data.selected_voice_catalog_id ?? data.voice_id ?? "")}
          onChange={(v) =>
            update({
              selected_voice_catalog_id: v.selected_voice_catalog_id,
              voice_provider: v.voice_provider,
              voice_provider_voice_id: v.voice_provider_voice_id,
              voice_id: v.voice_id,
              voice_label: v.voice_label,
              voice_sync_status: "pending",
              voice_last_sync_error: null,
            })
          }
        />
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">
            Sync status: <span className={voiceNeedsAttention ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>{String(data.voice_sync_status ?? "pending")}</span>
            {data.voice_last_sync_error ? ` · ${String(data.voice_last_sync_error)}` : ""}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={verifyVoiceSync} disabled={verifyingVoice || !clientId}>
            {verifyingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify voice sync"}
          </Button>
          {voiceNeedsAttention && (
            <span className="text-xs text-destructive">Voice setup needs attention</span>
          )}
        </div>
        <div className="grid md:grid-cols-3 gap-4 pt-2">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={data.language || "en-US"} onValueChange={(v) => update({ language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="en-GB">English (UK)</SelectItem>
                <SelectItem value="es-US">Spanish (US)</SelectItem>
                <SelectItem value="fr-FR">French</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Conversation Style</Label>
            <Select value={data.conversation_style || "concise"} onValueChange={(v) => update({ conversation_style: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={data.tone || "Friendly"} onValueChange={(v) => update({ tone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Friendly">Friendly</SelectItem>
                <SelectItem value="Energetic">Energetic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>AI Personality (free-form)</Label>
          <Textarea
            rows={2}
            placeholder="e.g. Warm, patient, never rushes the caller. Apologizes for the wait if needed."
            value={data.ai_personality || ""}
            onChange={(e) => update({ ai_personality: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Call Handling</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Transfer Number</Label>
            <Input
              type="tel"
              value={data.transfer_number || data.forward_phone || ""}
              onChange={(e) => update({ transfer_number: e.target.value })}
            />
          </div>
        </div>
        <Toggle label="Voicemail enabled" value={!!data.voicemail_enabled} onChange={(v) => update({ voicemail_enabled: v })} />
        <Toggle label="Call recording" value={!!data.call_recording_enabled} onChange={(v) => update({ call_recording_enabled: v })} />
        <Toggle label="Call summary" value={!!data.call_summary_enabled} onChange={(v) => update({ call_summary_enabled: v })} />
        <Toggle label="SMS follow-up to customer" value={!!data.sms_followup_enabled} onChange={(v) => update({ sms_followup_enabled: v })} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Scheduling</h2>
        <Toggle label="Scheduling enabled" value={!!data.scheduling_enabled} onChange={(v) => update({ scheduling_enabled: v })} />
        {data.scheduling_enabled && (
          <>
            <div className="space-y-2">
              <Label>Scheduling Mode</Label>
              <Select value={data.scheduling_mode || "intake_only"} onValueChange={(v) => update({ scheduling_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="intake_only">Intake Only</SelectItem>
                  <SelectItem value="collect_preferred_time">Collect Preferred Day/Time</SelectItem>
                  <SelectItem value="book_from_calendar">Book From Connected Calendar</SelectItem>
                  <SelectItem value="transfer_to_office">Transfer To Office</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label>Diagnostic / Service Fee ($)</Label>
              <Input
                type="number"
                value={data.diagnostic_fee ?? ""}
                onChange={(e) => update({ diagnostic_fee: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Live Greeting Preview</h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground mb-2">
            Voice: <strong>{data.voice_label || VOICES.find((v) => v.id === data.voice_id)?.label || "—"}</strong>
          </p>
          <p className="italic">"{data.greeting || "Your greeting will appear here."}"</p>
        </div>
        <TestCallButton clientId={clientId ?? undefined} />
      </section>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="bg-cta hover:opacity-90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save AI Receptionist
        </Button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}