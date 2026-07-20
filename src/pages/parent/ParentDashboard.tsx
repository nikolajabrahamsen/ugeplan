import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getOrCreateFamily } from "../../lib/family";
import ChildForm from "../../components/ChildForm";
import PairingCodeGenerator from "../../components/PairingCodeGenerator";

interface Child {
  id: string;
  name: string;
  avatar_pictogram_id: string | null;
}

export default function ParentDashboard() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadChildren() {
    // RLS sørger for kun at returnere børn i brugerens egen familie
    const { data, error } = await supabase
      .from("children")
      .select("id, name, avatar_pictogram_id")
      .order("name");

    if (!error && data) setChildren(data);
  }

  useEffect(() => {
    async function init() {
      try {
        const family = await getOrCreateFamily();
        setFamilyId(family.id);
        await loadChildren();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Der skete en fejl");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  if (loading) return <p>Henter...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="parent-dashboard">
      <h1>Jeres børn</h1>
      <ul className="children-list">
        {children.map((child) => (
          <li key={child.id} className="child-row">
            <Link to={`/parent/child/${child.id}/plan`}>{child.name} — redigér ugeplan</Link>
            <PairingCodeGenerator childId={child.id} childName={child.name} />
          </li>
        ))}
      </ul>

      {familyId && <ChildForm familyId={familyId} onCreated={loadChildren} />}

      {children.length > 0 && (
        <p className="switch-to-child-view">
          <Link to="/child">Skift til børnenes visning →</Link>
        </p>
      )}
    </div>
  );
}
