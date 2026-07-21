import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getOrCreateFamily } from "../../lib/family";
import { resolvePictogramImageUrl } from "../../lib/pictograms";
import ChildForm from "../../components/ChildForm";
import PairingCodeGenerator from "../../components/PairingCodeGenerator";
import InstallAppPrompt from "../../components/InstallAppPrompt";
import FamilyParents from "../../components/FamilyParents";
import EditChildModal from "../../components/EditChildModal";

interface Child {
  id: string;
  name: string;
  birth_year: number | null;
  avatar_pictogram_id: string | null;
}

export default function ParentDashboard() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingChild, setEditingChild] = useState<Child | null>(null);

  async function loadChildren() {
    // RLS sørger for kun at returnere børn i brugerens egen familie
    const { data, error } = await supabase
      .from("children")
      .select("id, name, birth_year, avatar_pictogram_id")
      .order("name");

    if (!error && data) setChildren(data);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
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

  if (loading) return <p className="loading-text">Henter...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Ugeplan</h1>
        <button type="button" className="btn-icon" onClick={handleSignOut} aria-label="Log ud">
          Log ud
        </button>
      </header>

      <InstallAppPrompt />

      {children.length === 0 && (
        <p className="empty-state">Tilføj jeres første barn for at komme i gang.</p>
      )}

      <ul className="children-list">
        {children.map((child) => (
          <li key={child.id} className="child-row">
            <div className="child-row-heading">
              <button
                type="button"
                className="child-avatar-button"
                onClick={() => setEditingChild(child)}
                aria-label={`Redigér ${child.name}`}
              >
                {child.avatar_pictogram_id ? (
                  <img
                    src={resolvePictogramImageUrl(child.avatar_pictogram_id, 100)}
                    alt=""
                    className="child-avatar-img"
                  />
                ) : (
                  <span className="child-avatar">{child.name.charAt(0).toUpperCase()}</span>
                )}
              </button>
              <Link to={`/parent/child/${child.id}/plan`} className="child-name-link">
                {child.name}
              </Link>
              <button
                type="button"
                className="btn-icon child-edit-link"
                onClick={() => setEditingChild(child)}
              >
                Redigér
              </button>
            </div>
            <PairingCodeGenerator childId={child.id} childName={child.name} />
          </li>
        ))}
      </ul>

      {familyId && <ChildForm familyId={familyId} onCreated={loadChildren} />}

      {familyId && <FamilyParents familyId={familyId} />}

      {children.length > 0 && (
        <Link to="/child" className="btn btn-secondary switch-to-child-view">
          Skift til børnenes visning →
        </Link>
      )}

      {editingChild && (
        <EditChildModal
          child={editingChild}
          onClose={() => setEditingChild(null)}
          onSaved={() => {
            setEditingChild(null);
            loadChildren();
          }}
        />
      )}
    </div>
  );
}
