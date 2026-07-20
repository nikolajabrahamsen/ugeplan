import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Bruges som "/" (app'ens start_url i manifest.json) og som fallback for
 * ukendte stier. Uden denne ville en genåbnet PWA altid ramme /login
 * først, uanset om enheden faktisk allerede er en parret barne-enhed
 * eller en logget ind forælder - og en anonym enheds-session ville fejlagtigt
 * kunne blive sendt ind i forælder-delen. Her tjekkes sessionstypen først,
 * og brugeren sendes direkte det rigtige sted hen.
 */
export default function StartRoute() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session) {
        setTarget("/login");
      } else if (session.user.is_anonymous) {
        setTarget("/child");
      } else {
        setTarget("/parent");
      }
    });
  }, []);

  if (!target) return <p className="loading-text">Åbner...</p>;
  return <Navigate to={target} replace />;
}
