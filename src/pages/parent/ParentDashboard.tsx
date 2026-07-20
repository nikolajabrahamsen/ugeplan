import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

interface Child {
  id: string;
  name: string;
  avatar_pictogram_id: string | null;
}

export default function ParentDashboard() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadChildren() {
      // RLS sørger for kun at returnere børn i brugerens egen familie
      const { data, error } = await supabase
        .from("children")
        .select("id, name, avatar_pictogram_id")
        .order("name");

      if (!error && data) setChildren(data);
      setLoading(false);
    }
    loadChildren();
  }, []);

  return (
    <div className="parent-dashboard">
      <h1>Jeres børn</h1>
      {loading && <p>Henter...</p>}
      <ul className="children-list">
        {children.map((child) => (
          <li key={child.id}>
            {child.name}
            {/* Her linkes videre til redigering af ugens aktiviteter for barnet */}
          </li>
        ))}
      </ul>
      {/* TODO: Formular til at oprette barn, og ugeplan-editor
          (vælg dag -> søg ARASAAC-piktogram -> sæt titel -> gem som activity) */}
    </div>
  );
}
