import { ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <FullPageLoader />;
  if (user) {
    const next = params.get("next");
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    return <Navigate to={safe} replace />;
  }
  return <>{children}</>;
}