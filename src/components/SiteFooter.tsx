import { Link } from "react-router-dom";
import vektuorLogo from "@/assets/vektuor-logo.png";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-24 py-10 bg-background">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <img src={vektuorLogo} alt="Vektuor" className="h-7 w-auto" width={1536} height={1024} loading="lazy" />
        </div>
        <p>© {new Date().getFullYear()} Vektuor. Never miss a job.</p>
        <div className="flex gap-5">
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link to="/demo" className="hover:text-foreground">Demo</Link>
          <Link to="/support" className="hover:text-foreground">Support</Link>
        </div>
      </div>
    </footer>
  );
}