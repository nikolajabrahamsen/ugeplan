import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Props {
  childId: string;
  childName: string;
}

/**
 * Lader en forælder generere en kortlivet parringskode til at knytte
 * barnets egen enhed (iPad/telefon) til dette barns ugeplan - uden at
 * enheden behøver forælderens login. Se redeem_pairing_code i
 * migrationen for hvordan koden indløses på enheden.
 */
export default function PairingCodeGenerator({ childId, childName }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("generate_pairing_code", {
      target_child_id: childId
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCode(data as string);
  }

  return (
    <div className="pairing-code-box">
      {code ? (
        <p>
          Kode til {childName}s enhed: <strong className="pairing-code">{code}</strong>
          <br />
          Indtast den på {childName}s iPad/telefon under "Tilknyt denne enhed" inden 10 minutter.
        </p>
      ) : (
        <button type="button" className="btn btn-secondary btn-small" onClick={handleGenerate} disabled={loading}>
          {loading ? "Genererer..." : `Generér kode til ${childName}s enhed`}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
