import { useEffect, useState } from "react";
import {
  getCalendarAccess,
  grantCalendarAccess,
  revokeCalendarAccess
} from "../lib/familyCalendarAccess";

interface SiblingChild {
  id: string;
  name: string;
}

interface Props {
  calendarId: string;
  siblings: SiblingChild[]; // alle "rigtige" børn i familien (ikke andre kalendere)
}

/** Lader en forælder styre hvilke børn der må se en given familiekalender. */
export default function FamilyCalendarAccessControl({ calendarId, siblings }: Props) {
  const [accessChildIds, setAccessChildIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCalendarAccess(calendarId)
      .then((ids) => setAccessChildIds(new Set(ids)))
      .finally(() => setLoaded(true));
  }, [calendarId]);

  async function toggle(childId: string, hasAccess: boolean) {
    setError(null);
    try {
      if (hasAccess) {
        await revokeCalendarAccess(calendarId, childId);
        setAccessChildIds((prev) => {
          const next = new Set(prev);
          next.delete(childId);
          return next;
        });
      } else {
        await grantCalendarAccess(calendarId, childId);
        setAccessChildIds((prev) => new Set(prev).add(childId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke ændre adgangen.");
    }
  }

  if (!loaded || siblings.length === 0) return null;

  return (
    <div className="calendar-access">
      <p className="calendar-access-label">Adgang til kalenderen:</p>
      <div className="calendar-access-list">
        {siblings.map((sibling) => {
          const hasAccess = accessChildIds.has(sibling.id);
          return (
            <label key={sibling.id} className="calendar-access-item">
              <input
                type="checkbox"
                checked={hasAccess}
                onChange={() => toggle(sibling.id, hasAccess)}
              />
              {sibling.name}
            </label>
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
