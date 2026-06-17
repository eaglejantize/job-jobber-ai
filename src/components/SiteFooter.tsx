import { Link } from "react-router-dom";
import { PhoneCall } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white mt-16">
      <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-ink">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-brand text-white">
            <PhoneCall className="h-3.5 w-3.5" />
          </span>
          <span className="font-semibold text-navy">Vektuor</span>
        </Link>
        <p className="text-muted-foreground">© {new Date().getFullYear()} Vektuor. All rights reserved.</p>
        <div className="flex gap-5">
          <Link to="/pricing" className="hover:text-navy">Pricing</Link>
          <Link to="/demo" className="hover:text-navy">Demo</Link>
          <Link to="/support" className="hover:text-navy">Support</Link>
        </div>
      </div>
    </footer>
  );
}