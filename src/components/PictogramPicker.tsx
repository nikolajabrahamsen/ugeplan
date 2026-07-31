import { useState } from "react";
import { searchAllPictograms, uploadCustomPictogram, type PictogramResult } from "../lib/pictograms";

interface Props {
  familyId?: string;
  onSelect: (storedValue: string) => void;
  onClose: () => void;
}

/**
 * Piktogram-søgning på tværs af flere biblioteker (ARASAAC + OpenSymbols,
 * som selv samler Sclera, Mulberry m.fl., + familiens eget bibliotek af
 * uploadede billeder hvis familyId er kendt). Bruges kun i forældre-UI'et
 * (fx når en aktivitet oprettes/redigeres) - IKKE i børnenes visning, som
 * kun viser allerede-valgte piktogrammer via resolvePictogramImageUrl.
 */
export default function PictogramPicker({ familyId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PictogramResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const found = await searchAllPictograms(query.trim(), familyId);
      setResults(found.slice(0, 48));
    } catch {
      setError("Kunne ikke hente piktogrammer lige nu. Prøv igen.");
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadLabel.trim() || !familyId) return;
    setUploading(true);
    setError(null);
    try {
      const pictogram = await uploadCustomPictogram(familyId, uploadFile, uploadLabel.trim());
      onSelect(pictogram.storedValue);
    } catch {
      setError("Kunne ikke uploade billedet. Prøv igen.");
    } finally {
      setUploading(false);
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

        {!showUpload ? (
          <>
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

            {familyId && (
              <button
                type="button"
                className="btn btn-ghost btn-small custom-upload-toggle"
                onClick={() => setShowUpload(true)}
              >
                📷 Tilføj eget billede
              </button>
            )}

            {error && <p className="error">{error}</p>}

            {hasSearched && !loading && results.length === 0 && !error && (
              <p className="pictogram-empty-state">
                Ingen piktogrammer fundet for "{query}". Prøv et andet ord, gerne på engelsk.
              </p>
            )}

            <div className="pictogram-results">
              {results.map((pictogram) => (
                <button
                  key={pictogram.storedValue}
                  type="button"
                  className="pictogram-result"
                  onClick={() => onSelect(pictogram.storedValue)}
                >
                  <img src={pictogram.imageUrl} alt="" width={100} height={100} />
                  <span>{pictogram.label}</span>
                  {pictogram.source === "opensymbols" && pictogram.repoKey && (
                    <span className="pictogram-source-badge">{pictogram.repoKey}</span>
                  )}
                  {pictogram.source === "custom" && (
                    <span className="pictogram-source-badge">eget billede</span>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={handleUpload} className="custom-upload-form">
            <label htmlFor="custom-pictogram-file">Vælg billede</label>
            <input
              id="custom-pictogram-file"
              type="file"
              accept="image/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            {uploadFile && (
              <img
                src={URL.createObjectURL(uploadFile)}
                alt=""
                width={100}
                height={100}
                className="custom-upload-preview"
              />
            )}
            <label htmlFor="custom-pictogram-label">Titel/søgeord</label>
            <input
              id="custom-pictogram-label"
              type="text"
              placeholder="fx 'Mormor', 'vores hus'"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
            />
            <div className="edit-child-actions">
              <button
                type="submit"
                className="btn btn-primary btn-small"
                disabled={!uploadFile || !uploadLabel.trim() || uploading}
              >
                {uploading ? "Uploader..." : "Gem og vælg"}
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setShowUpload(false)}>
                Tilbage til søgning
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
