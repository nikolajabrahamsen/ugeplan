import { useState } from "react";
import {
  searchPictograms,
  pictogramImageUrl,
  pictogramId,
  pictogramKeyword,
  type ArasaacPictogram
} from "../lib/arasaac";

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
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const found = await searchPictograms(query.trim());
      // Kun tag piktogrammer hvor vi rent faktisk kan udlede et id
      setResults(found.filter((p) => pictogramId(p) !== undefined).slice(0, 48));
    } catch {
      setError("Kunne ikke hente piktogrammer lige nu. Prøv igen.");
    } finally {
      setLoading(false);
      setHasSearched(true);
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

        {hasSearched && !loading && results.length === 0 && !error && (
          <p className="pictogram-empty-state">
            Ingen piktogrammer fundet for "{query}". Prøv et andet ord, gerne på engelsk.
          </p>
        )}

        <div className="pictogram-results">
          {results.map((pictogram) => {
            const id = pictogramId(pictogram)!;
            return (
              <button
                key={id}
                type="button"
                className="pictogram-result"
                onClick={() => onSelect(String(id))}
              >
                <img src={pictogramImageUrl(id, 300)} alt="" width={100} height={100} />
                <span>{pictogramKeyword(pictogram)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
