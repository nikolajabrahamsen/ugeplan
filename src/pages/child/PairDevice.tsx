import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/**
 * Åbnes på BARNETS EGEN enhed (uden at nogen forælder er logget ind der).
 * Enheden logger ind anonymt og indløser en kode genereret af en
 * forælder i ParentDashboard. Efter succesfuld parring husker enheden
 * dette permanent (indtil man logger ud), og ChildProfilePicker vil
 * fra da af kun vise netop dette barn.
 */
export default function PairDevice() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Opret (eller genbrug) en anonym session for denne enhed
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
      }

      const { data: childId, error: redeemError } = await supabase.rpc(
        "redeem_pairing_code",
        { input_code: code.trim() }
      );
      if (redeemError) throw redeemError;

      navigate(`/child/${childId}/week`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kunne ikke tilknytte enheden - prøv igen."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <h1>Tilknyt denne enhed</h1>
      <p>Bed en forælder om at generere en kode i appen, og indtast den her.</p>
      <form onSubmit={handlePair}>
        <label htmlFor="pairing-code">Kode</label>
        <input
          id="pairing-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          autoFocus
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Tilknytter..." : "Tilknyt"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
