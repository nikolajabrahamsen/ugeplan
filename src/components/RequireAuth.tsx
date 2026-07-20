import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

interface Props {
  children: React.ReactNode;
  /** Sæt til true for forældre-ruter: afviser en barne-enheds anonyme session. */
  requireParent?: boolean;
}

/**
 * Beskytter ruter der kræver en aktiv session. Med requireParent slået til
 * (forældre-ruterne) afvises en barne-enheds anonyme session eksplicit -
 * uden det ville en barne-enhed der ved en fejl rammer en forældre-URL
 * kunne trigge oprettelse af en helt ny, tom familie under sig selv.
 */
export default function RequireAuth({ children, requireParent = false }: Props) {
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<"none" | "anonymous" | "parent">("none");

  useEffect(() => {
    function update(session: { user: { is_anonymous?: boolean } } | null) {
      if (!session) setStatus("none");
      else setStatus(session.user.is_anonymous ? "anonymous" : "parent");
    }

    supabase.auth.getSession().then(({ data }) => {
      update(data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      update(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (checking) return <p className="loading-text">Tjekker login...</p>;
  if (status === "none") return <Navigate to="/login" replace />;
  if (requireParent && status === "anonymous") return <Navigate to="/child" replace />;
  return <>{children}</>;
}
