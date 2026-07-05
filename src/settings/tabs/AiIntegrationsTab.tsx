import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, Copy, ShieldCheck, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const projectRef =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ??
  "mzqazxtcwqumroqtmtjd";
const MCP_URL = `https://${projectRef}.supabase.co/functions/v1/mcp`;

const TOOLS: { name: string; description: string }[] = [
  { name: "list_recent_leads", description: "List your most recent captured leads." },
  { name: "get_lead", description: "Get full details for a single lead, including transcript." },
  { name: "list_recent_calls", description: "List your most recent AI receptionist calls." },
  { name: "get_business_profile", description: "Read your business profile, hours, greeting, and phone." },
];

export default function AiIntegrationsTab() {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      toast({ title: "MCP URL copied" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Copy the URL manually.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">AI Integrations</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect Vektuor to AI tools so you can ask questions about your leads, calls, and business profile.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="mcp-url">MCP Server URL</Label>
          <div className="flex gap-2">
            <Input id="mcp-url" readOnly value={MCP_URL} onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={copyUrl} variant="outline" className="shrink-0">
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied" : "Copy MCP URL"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste this URL into your AI client when adding a custom connector.
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Available tools</h3>
          <Badge variant="secondary">Read-only</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          These tools can view your data but cannot make changes. Write and action tools are not available yet.
        </p>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {TOOLS.map((t) => (
            <li key={t.name} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <code className="text-sm font-mono text-foreground">{t.name}</code>
              <span className="text-sm text-muted-foreground">{t.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Setup instructions</h3>
        <Accordion type="single" collapsible className="rounded-xl border border-border bg-card">
          <AccordionItem value="chatgpt" className="border-b border-border last:border-b-0">
            <AccordionTrigger className="px-4">ChatGPT</AccordionTrigger>
            <AccordionContent className="px-4">
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  Open{" "}
                  <a
                    className="text-foreground underline"
                    href="https://chatgpt.com/#settings/Connectors/Advanced"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ChatGPT Connectors settings
                  </a>{" "}
                  and enable Developer mode.
                </li>
                <li>In the chat composer's "+" menu, turn on Developer mode.</li>
                <li>Click "Add sources" → "Connect more".</li>
                <li>Name the connector "Vektuor" and paste the MCP URL above.</li>
                <li>Sign in with your Vektuor account and approve access when prompted.</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="claude" className="border-b border-border last:border-b-0">
            <AccordionTrigger className="px-4">Claude</AccordionTrigger>
            <AccordionContent className="px-4">
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  Open{" "}
                  <a
                    className="text-foreground underline"
                    href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Claude custom connectors
                  </a>
                  .
                </li>
                <li>Name the connector "Vektuor" and paste the MCP URL above.</li>
                <li>Enable the connector from the chat composer, then sign in and approve access.</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="cursor" className="border-b border-border last:border-b-0">
            <AccordionTrigger className="px-4">Cursor</AccordionTrigger>
            <AccordionContent className="px-4">
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
                <li>Open Cursor Settings → MCP → "Add new MCP server".</li>
                <li>Choose HTTP transport, name it "Vektuor", and paste the MCP URL above.</li>
                <li>Save; Cursor will open your browser to sign in and approve access.</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h3 className="font-semibold">How sign-in works</h3>
        <p className="text-sm text-muted-foreground">
          When you connect an AI client, you'll be redirected to Vektuor to sign in and approve the connection.
          The client never sees your password — it receives a scoped access token issued only after you approve.
        </p>
      </section>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Your data stays scoped to your account</AlertTitle>
        <AlertDescription>
          Access is scoped to your signed-in Vektuor account and protected by row-level security. AI clients
          can only see data that belongs to your account.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Only connect AI clients you trust</AlertTitle>
        <AlertDescription>
          A connected client can read all leads, calls, and business profile data on your behalf until you
          disconnect it from that client.
        </AlertDescription>
      </Alert>
    </div>
  );
}