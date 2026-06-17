import { Link } from "react-router-dom";
import { PhoneCall } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-white">
                <PhoneCall className="h-4 w-4" />
              </span>
              <span className="text-lg font-semibold tracking-tight text-navy">Vektuor</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-ink">
              The 24/7 AI receptionist built for service businesses.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Product</div>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><a href="#features" className="text-ink hover:text-navy">Features</a></li>
              <li><a href="#pricing" className="text-ink hover:text-navy">Pricing</a></li>
              <li><a href="#demo" className="text-ink hover:text-navy">Live demo</a></li>
              <li><a href="#faq" className="text-ink hover:text-navy">FAQ</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Company</div>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/support" className="text-ink hover:text-navy">Support</Link></li>
              <li><a href="mailto:support@vektuor.com" className="text-ink hover:text-navy">Contact</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account</div>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/auth" className="text-ink hover:text-navy">Sign in</Link></li>
              <li><Link to="/auth" className="text-ink hover:text-navy">Start free trial</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} Vektuor. All rights reserved.</div>
          <div>support@vektuor.com</div>
        </div>
      </div>
    </footer>
  );
}