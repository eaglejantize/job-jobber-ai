import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useControlCenterData } from "./useControlCenterData";
import { TABS } from "./tabs/registry";
import SyncToVapiButton from "./SyncToVapiButton";
import { ProgressPanel } from "@/onboarding/ProgressTracker";

export default function ControlCenter() {
  const ctx = useControlCenterData();
  const navigate = useNavigate();
  const initialTab =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("tab") || TABS[0].id
      : TABS[0].id;
  const [active, setActive] = useState(initialTab);

  if (ctx.loading) {
    return <div className="container py-20 text-muted-foreground">Loading…</div>;
  }

  const ActiveComponent = TABS.find((t) => t.id === active)?.component ?? TABS[0].component;

  return (
    <div className="container py-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AI Control Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vektuor is the single source of truth for your AI receptionist.
          </p>
        </div>
        <SyncToVapiButton
          clientId={ctx.clientId}
          lastSyncAt={ctx.data.last_vapi_sync_at}
          lastStatus={ctx.data.last_vapi_sync_status}
          onSynced={ctx.reload}
        />
      </div>

      <ProgressPanel className="mb-6" />

      <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/15 p-2">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-semibold">Launch AI Setup Concierge</div>
            <p className="text-sm text-muted-foreground">
              Skip the forms — let our guided assistant interview you and fill out your AI receptionist setup.
            </p>
          </div>
        </div>
        <Button onClick={() => navigate("/settings/concierge")} className="bg-cta hover:opacity-90">
          <Sparkles className="h-4 w-4" /> Launch Concierge
        </Button>
      </div>

      <div className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-background/80 backdrop-blur border-b border-border mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {t.badge && (
                  <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 text-[10px] px-1.5 py-0">
                    {t.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ActiveComponent ctx={ctx} />
    </div>
  );
}