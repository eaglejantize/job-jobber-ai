import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { to: "/", label: "Home" },
  { to: "/demo", label: "Demo" },
  { to: "/pricing", label: "Pricing" },
  { to: "/support", label: "Support" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2" aria-label="Vektuor home">
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
              end={l.to === "/"}
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
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <Button onClick={() => navigate("/dashboard")} className="bg-navy hover:bg-navy-deep text-white rounded-xl">
              Dashboard
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-ink hover:text-navy transition-colors"
              >
                Sign in
              </Link>
              <Button onClick={() => navigate("/auth")} className="bg-navy hover:bg-navy-deep text-white rounded-xl">
                Start Free Trial
              </Button>
            </>
          )}
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
        <div className="md:hidden border-t border-border bg-background">
          <div className="container py-3 flex flex-col gap-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
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
            {user ? (
              <Button
                onClick={() => { setOpen(false); navigate("/dashboard"); }}
                className="bg-navy hover:bg-navy-deep text-white rounded-xl mt-2"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <NavLink
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm font-medium text-navy"
                >
                  Sign in
                </NavLink>
                <Button
                  onClick={() => { setOpen(false); navigate("/auth"); }}
                  className="bg-navy hover:bg-navy-deep text-white rounded-xl mt-2"
                >
                  Start Free Trial
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}