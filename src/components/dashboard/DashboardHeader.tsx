import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = { today: number; leads: number; active: number; systemLive: boolean };

export default function DashboardHeader({ today, leads, active, systemLive }: Props) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b v-border backdrop-blur-md" style={{ background: "hsl(222 47% 4% / 0.7)" }}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "linear-gradient(135deg, hsl(152 84% 52%), hsl(270 92% 68%))" }}>
            <span className="font-black text-[14px] text-black">V</span>
          </span>
          <span className="text-lg font-semibold tracking-tight">Vektuor</span>
          <span className="hidden md:inline text-xs v-muted ml-2 px-2 py-0.5 rounded-full v-border border">LIVE OPS</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className={systemLive ? "v-live-dot h-2 w-2" : "h-2 w-2 rounded-full bg-zinc-500"} />
            <span className="v-muted">System</span>
            <span className="font-medium">{systemLive ? "Live" : "Idle"}</span>
          </div>
          <Stat label="Calls today" value={today} />
          <Stat label="Leads" value={leads} />
          <Stat label="Active" value={active} accent={active > 0} />
        </div>

        <div className="flex items-center gap-2">
          <Link to="/settings" className="p-2 rounded-lg hover:bg-white/5 v-muted hover:text-white transition" aria-label="Settings">
            <SettingsIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate("/", { replace: true }); }}
            className="p-2 rounded-lg hover:bg-white/5 v-muted hover:text-white transition" aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* mobile stats row */}
      <div className="md:hidden flex items-center gap-4 px-4 pb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={systemLive ? "v-live-dot h-1.5 w-1.5" : "h-1.5 w-1.5 rounded-full bg-zinc-500"} />
          <span className="v-muted">Live</span>
        </div>
        <Stat label="Today" value={today} compact />
        <Stat label="Leads" value={leads} compact />
        <Stat label="Active" value={active} compact accent={active > 0} />
      </div>
    </header>
  );
}

function Stat({ label, value, accent, compact }: { label: string; value: number; accent?: boolean; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${compact ? "text-xs" : ""}`}>
      <span className="v-muted">{label}</span>
      <span className={`tabular-nums font-semibold ${accent ? "text-[hsl(152_84%_60%)]" : ""}`}>{value}</span>
    </div>
  );
}