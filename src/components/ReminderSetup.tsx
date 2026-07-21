import { useEffect, useState } from "react";
import { enablePushNotifications, hasActivePushSubscription } from "../lib/push";

/**
 * Lader brugeren slå rigtige push-notifikationer til på DENNE enhed -
 * relevant for begge forældrenes egne telefoner og for et barns parrede
 * enhed, da påmindelser (fx medicin) bør nå begge steder.
 */
export default function ReminderSetup() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hasActivePushSubscription().then(setEnabled);
  }, []);

  async function handleEnable() {
    setLoading(true);
    setError(null);
    try {
      await enablePushNotifications();
      setEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke slå påmindelser til.");
    } finally {
      setLoading(false);
    }
  }

  if (enabled === null || enabled) return null; // stadig ved at tjekke, eller allerede slået til

  return (
    <div className="reminder-setup">
      <button type="button" className="btn btn-secondary btn-small" onClick={handleEnable} disabled={loading}>
        {loading ? "Slår til..." : "🔔 Slå påmindelser til på denne enhed"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
