import { useState } from "react";
import { searchPictograms, pictogramImageUrl, type ArasaacPictogram } from "../lib/arasaac";

interface Props {
  onSelect: (pictogramId: string) => void;
  onClose: () => void;
}

/**
 * Modal-lignende søgning i ARASAAC's piktogram-bibliotek.
 * Bruges kun i forældre-UI'et (fx når en aktivitet oprettes/redigeres) -
 * IKKE i børnenes visning, som kun viser allerede-valgte piktogrammer
 * (og dermed rammer den cachede statiske billed-URL, ikke søge-API'et).
 */
export default function PictogramPicker({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArasaacPictogram[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const found = await searchPictograms(query.trim());
      setResults(found.slice(0, 24)); // begræns til en overskuelig mængde
    } catch {
      setError("Kunne ikke hente piktogrammer lige nu. Prøv igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pictogram-picker-overlay" onClick={onClose}>
      <div className="pictogram-picker" onClick={(e) => e.stopPropagation()}>
        <div className="pictogram-picker-header">
          <h2>Vælg piktogram</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Luk">
            ✕
          </button>
        </div>

        <form onSubmit={handleSearch} className="pictogram-search-form">
          <input
            type="text"
            placeholder="Søg (fx 'spise', 'skole', 'bad')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-small" disabled={loading}>
            {loading ? "Søger..." : "Søg"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <div className="pictogram-results">
          {results.map((pictogram) => (
            <button
              key={pictogram.id}
              type="button"
              className="pictogram-result"
              onClick={() => onSelect(String(pictogram.id))}
            >
              <img src={pictogramImageUrl(pictogram.id, 300)} alt="" width={100} height={100} />
              <span>{pictogram.keywords[0]?.keyword ?? ""}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
