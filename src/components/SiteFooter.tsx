import { Link } from "react-router-dom";
import { Phone } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-24 py-10 bg-background">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cta text-primary-foreground">
            <Phone className="h-3.5 w-3.5" />
          </span>
          TryCallCapture
        </div>
        <p>Turn missed calls into booked jobs.</p>
        <div className="flex gap-5">
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link to="/demo" className="hover:text-foreground">Demo</Link>
          <Link to="/support" className="hover:text-foreground">Support</Link>
        </div>
      </div>
    </footer>
  );
}