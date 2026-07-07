import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PhoneCall, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const Logo = () => (
  <Link to="/" className="flex items-center gap-2">
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-white shadow-soft">
      <PhoneCall className="h-4 w-4" />
    </span>
    <span className="text-lg font-semibold tracking-tight text-navy">Vektuor</span>
  </Link>
);

const links = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Live demo", href: "#demo" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-ink hover:text-navy transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <Button asChild className="rounded-xl">
              <Link to="/home">Home</Link>
            </Button>
          ) : (
            <>
              <Link to="/auth" className="text-sm font-medium text-ink hover:text-navy">
                Sign in
              </Link>
              <Button asChild className="bg-navy hover:bg-navy-deep text-white rounded-xl">
                <Link to="/auth">Start Free Trial</Link>
              </Button>
            </>
          )}
        </div>
        <button
          aria-label="Toggle menu"
          className="md:hidden p-2 rounded-md border border-border text-ink"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container py-3 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-medium text-ink"
              >
                {l.label}
              </a>
            ))}
            {!user && (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-medium text-ink hover:text-navy"
              >
                Sign in
              </Link>
            )}
            <Button
              onClick={() => {
                setOpen(false);
                navigate(user ? "/home" : "/auth");
              }}
              className="mt-2 rounded-xl"
            >
              {user ? "Home" : "Start Free Trial"}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}