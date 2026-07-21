import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Props {
  familyId: string;
  onCreated: () => void;
}

/** Formular til at oprette et nyt barn - eller familiens fælles kalender - i familien. */
export default function ChildForm({ familyId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [isFamilyCalendar, setIsFamilyCalendar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("children").insert({
      family_id: familyId,
      name: name.trim(),
      birth_year: isFamilyCalendar ? null : birthYear ? Number(birthYear) : null,
      is_family_calendar: isFamilyCalendar
    });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setBirthYear("");
    setIsFamilyCalendar(false);
    onCreated();
  }

  return (
    <form className="child-form card" onSubmit={handleSubmit}>
      <h3>Tilføj barn eller kalender</h3>

      <label className="recur-checkbox">
        <input
          type="checkbox"
          checked={isFamilyCalendar}
          onChange={(e) => setIsFamilyCalendar(e.target.checked)}
        />
        Dette er en fælles familiekalender (ikke ét bestemt barn)
      </label>

      <label htmlFor="child-name">{isFamilyCalendar ? "Kalenderens navn" : "Navn"}</label>
      <input
        id="child-name"
        type="text"
        placeholder={isFamilyCalendar ? "fx Familiekalender" : ""}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      {!isFamilyCalendar && (
        <>
          <label htmlFor="child-birth-year">Fødselsår (valgfrit)</label>
          <input
            id="child-birth-year"
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            min={2000}
            max={2030}
          />
        </>
      )}

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Gemmer..." : isFamilyCalendar ? "Opret kalender" : "Tilføj barn"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
