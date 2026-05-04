import { Link, NavLink, useNavigate } from "react-router-dom";
import { Phone, Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/leads", label: "Inbox" },
  { to: "/settings", label: "Settings" },
];

export default function AppNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cta text-primary-foreground shadow-glow">
            <Phone className="h-4 w-4" />
          </span>
          <span>TryCallCapture</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "text-sm font-medium transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        <button
          aria-label="Open menu"
          className="md:hidden p-2 rounded-md border border-border"
          onClick={() => setOpen((o) => !o)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-card">
          <div className="container py-3 flex flex-col gap-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "py-2 text-sm",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Button
              variant="outline"
              onClick={() => { setOpen(false); void signOut(); }}
              className="mt-2"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}