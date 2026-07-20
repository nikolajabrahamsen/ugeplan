import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { pictogramImageUrl } from "../../lib/arasaac";

interface Child {
  id: string;
  name: string;
  avatar_pictogram_id: string | null;
}

/**
 * "Kiosk-indgang" - vises efter forælderen er logget ind, så barnet selv
 * kan vælge sin egen profil uden at have sit eget login. En evt. PIN-kode
 * (children.pin_code) kan tilføjes her som ekstra spærre, hvis familien
 * ønsker det, men er ikke påkrævet.
 */
export default function ChildProfilePicker() {
  const [children, setChildren] = useState<Child[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadChildren() {
      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_pictogram_id")
        .order("name");
      if (!error && data) setChildren(data);
    }
    loadChildren();
  }, []);

  return (
    <div className="profile-picker">
      <h1>Hvem er du?</h1>
      <div className="profile-grid">
        {children.map((child) => (
          <button
            key={child.id}
            className="profile-card"
            onClick={() => navigate(`/child/${child.id}/week`)}
          >
            {child.avatar_pictogram_id && (
              <img
                src={pictogramImageUrl(child.avatar_pictogram_id)}
                alt=""
                width={120}
                height={120}
              />
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
