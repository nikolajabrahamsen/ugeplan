import { useEffect, useState } from "react";
import { listFamilyParents, inviteParent, type FamilyParent } from "../lib/family";

interface Props {
  familyId: string;
}

export default function FamilyParents({ familyId }: Props) {
  const [parents, setParents] = useState<FamilyParent[]>([]);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadParents() {
    try {
      const list = await listFamilyParents(familyId);
      setParents(list);
    } catch {
      // Stille fejl - visning af forældre er ikke kritisk for resten af siden
    }
  }

  useEffect(() => {
    loadParents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await inviteParent(familyId, email.trim());
      setMessage(
        `${email} kan nu logge ind med sin egen email og bliver automatisk tilknyttet jeres familie.`
      );
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke sende invitationen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card family-parents">
      <h3>Forældre i familien</h3>
      <ul className="parent-list">
        {parents.map((parent) => (
          <li key={parent.user_id}>{parent.email}</li>
        ))}
      </ul>

      <form onSubmit={handleInvite} className="invite-form">
        <label htmlFor="invite-email">Inviter en forælder mere</label>
        <input
          id="invite-email"
          type="email"
          placeholder="partner@email.dk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary btn-small" disabled={saving}>
          {saving ? "Sender..." : "Inviter"}
        </button>
      </form>

      {message && <p className="invite-success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
