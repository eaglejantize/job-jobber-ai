import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";

export default function Confirm() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const t = setTimeout(() => {
      navigate(`/setup${location.search}`, { replace: true });
    }, 2000);
    return () => clearTimeout(t);
  }, [navigate, location.search]);

  return (
    <Layout>
      <section className="container py-24 text-center">
        <h1 className="text-2xl font-semibold">Redirecting to setup…</h1>
        <p className="mt-3 text-muted-foreground">One moment while we take you to the next step.</p>
      </section>
    </Layout>
  );
}