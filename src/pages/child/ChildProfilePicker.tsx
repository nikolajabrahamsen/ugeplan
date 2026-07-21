import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { resolvePictogramImageUrl } from "../../lib/pictograms";

interface Child {
  id: string;
  name: string;
  avatar_pictogram_id: string | null;
  is_family_calendar: boolean;
}

/**
 * "Kiosk-indgang" - vises efter forælderen er logget ind, så barnet selv
 * kan vælge sin egen profil uden at have sit eget login. En evt. PIN-kode
 * (children.pin_code) kan tilføjes her som ekstra spærre, hvis familien
 * ønsker det, men er ikke påkrævet.
 */
export default function ChildProfilePicker() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadChildren() {
      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_pictogram_id, is_family_calendar")
        .order("name");
      if (!error && data) setChildren(data);
      setLoaded(true);
    }
    loadChildren();
  }, []);

  useEffect(() => {
    async function maybeAutoSelect() {
      if (!loaded || children.length !== 1) return;
      // En parret barne-enhed har altid præcis ét barn synligt (RLS
      // begrænser den til netop det barn den blev parret til) - så på en
      // sådan enhed er der intet at vælge imellem, og vi springer direkte
      // til ugeplanen for en glidende genåbning. En forælder med kun ét
      // barn i familien rammer også denne, hvilket bare er lidt bekvemt.
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.is_anonymous) {
        navigate(`/child/${children[0].id}/week`, { replace: true });
      }
    }
    maybeAutoSelect();
  }, [loaded, children, navigate]);

  return (
    <div className="profile-picker">
      <h1>Hvem er du? 👋</h1>
      <div className="profile-grid">
        {children.map((child) => (
          <button
            key={child.id}
            className="profile-card"
            onClick={() => navigate(`/child/${child.id}/week`)}
          >
            {child.avatar_pictogram_id ? (
              <img
                src={resolvePictogramImageUrl(child.avatar_pictogram_id)}
                alt=""
                width={120}
                height={120}
              />
            ) : child.is_family_calendar ? (
              <span className="profile-card-initial">📅</span>
            ) : (
              <span className="profile-card-initial">{child.name.charAt(0).toUpperCase()}</span>
            )}
            <span>{child.name}</span>
          </button>
        ))}
      </div>
      <p className="pair-device-link">
        <a href="/pair">Ny enhed? Tilknyt den her</a>
      </p>
    </div>
  );
}
