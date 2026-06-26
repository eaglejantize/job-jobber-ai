import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, LogOut, PhoneCall, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import ThemeToggle from "@/components/ThemeToggle";
import { SetupProgressPill } from "@/components/SetupProgressBadge";

const links = [
  { to: "/home", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/leads", label: "Inbox" },
  { to: "/settings", label: "Settings" },
];

export default function AppNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/home" className="flex items-center gap-2" aria-label="Vektuor home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-white shadow-soft">
            <PhoneCall className="h-4 w-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-navy">Vektuor</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "text-sm font-medium transition-colors hover:text-navy",
                  isActive ? "text-navy" : "text-ink",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-emerald-600",
                  isActive ? "text-emerald-600" : "text-emerald-700",
                )
              }
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </NavLink>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <SetupProgressPill />
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={signOut} className="rounded-xl border-border bg-background text-foreground hover:bg-secondary">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            aria-label="Open menu"
            className="p-2 rounded-md border border-border"
            onClick={() => setOpen((o) => !o)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container py-3 flex flex-col gap-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "py-2 text-sm",
                    isActive ? "text-navy" : "text-ink",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-medium text-emerald-700"
              >
                Admin
              </NavLink>
            )}
            <Button
              variant="outline"
              onClick={() => { setOpen(false); void signOut(); }}
              className="mt-2 rounded-xl border-border bg-white text-navy"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}