import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { resolvePictogramImageUrl } from "../lib/pictograms";
import PictogramPicker from "./PictogramPicker";

interface Child {
  id: string;
  name: string;
  birth_year: number | null;
  avatar_pictogram_id: string | null;
}

interface Props {
  child: Child;
  onSaved: () => void;
  onClose: () => void;
}

/** Modal til at redigere et barns navn, fødselsår og profilbillede (piktogram som avatar). */
export default function EditChildModal({ child, onSaved, onClose }: Props) {
  const [name, setName] = useState(child.name);
  const [birthYear, setBirthYear] = useState(child.birth_year?.toString() ?? "");
  const [avatarId, setAvatarId] = useState<string | null>(child.avatar_pictogram_id);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("children")
      .update({
        name: name.trim(),
        birth_year: birthYear ? Number(birthYear) : null,
        avatar_pictogram_id: avatarId
      })
      .eq("id", child.id);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="pictogram-picker-overlay" onClick={onClose}>
      <div className="pictogram-picker edit-child-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pictogram-picker-header">
          <h2>Redigér {child.name}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Luk">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave}>
          <button
            type="button"
            className="avatar-picker-button"
            onClick={() => setPickingAvatar(true)}
          >
            {avatarId ? (
              <img src={resolvePictogramImageUrl(avatarId, 300)} alt="" width={80} height={80} />
            ) : (
              <span className="profile-card-initial small">{name.charAt(0).toUpperCase() || "?"}</span>
            )}
            <span className="btn-icon">Vælg profilbillede</span>
          </button>

          <label htmlFor="edit-child-name">Navn</label>
          <input
            id="edit-child-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <label htmlFor="edit-child-birth-year">Fødselsår (valgfrit)</label>
          <input
            id="edit-child-birth-year"
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            min={2000}
            max={2030}
          />

          <div className="edit-child-actions">
            <button type="submit" className="btn btn-primary btn-small" disabled={saving}>
              {saving ? "Gemmer..." : "Gem"}
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
              Annullér
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      {pickingAvatar && (
        <PictogramPicker
          onSelect={(id) => {
            setAvatarId(id);
            setPickingAvatar(false);
          }}
          onClose={() => setPickingAvatar(false)}
        />
      )}
    </div>
  );
}
