import { ReactNode } from "react";
import SiteNav from "./SiteNav";
import AppNav from "./AppNav";
import SiteFooter from "./SiteFooter";
import { useAuth } from "@/hooks/useAuth";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      {loading ? (
        <header className="sticky top-0 z-40 h-16 border-b border-border/60 bg-background/80 backdrop-blur-md" />
      ) : user ? (
        <AppNav />
      ) : (
        <SiteNav />
      )}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}