// Hjælpefunktioner til ARASAAC piktogram-API (https://api.arasaac.org)
//
// OBS: ARASAAC-API'et er ikke beregnet til at blive kaldt live for hver
// visning i en produktions-app. Søgning (searchPictograms) bruges kun i
// forældre-visningen når man vælger et piktogram til en aktivitet.
// Selve billed-URL'en (pictogramImageUrl) caches derefter automatisk af
// service workeren (se vite.config.ts -> arasaac-pictograms cache).

const ARASAAC_API_BASE = "https://api.arasaac.org/v1";
const ARASAAC_STATIC_BASE = "https://static.arasaac.org/pictograms";

export interface ArasaacPictogram {
  id?: number;
  _id?: number;
  keywords?: { keyword?: string; text?: string }[];
}

/**
 * Søg piktogrammer. ARASAAC's danske søgeord er langt fra så komplette som
 * de spanske/engelske (dansk er et community-oversat sprog i biblioteket,
 * og mange piktogrammer mangler simpelthen en dansk oversættelse selvom
 * selve billedet findes). Derfor: søg dansk først, og suppler automatisk
 * med en engelsk søgning hvis det danske resultat er sparsomt - så
 * forælderen ser markant flere relevante piktogrammer, uden at skulle
 * gætte hvilket sprog et givent piktogram er tagget på.
 */
export async function searchPictograms(query: string): Promise<ArasaacPictogram[]> {
  const danish = await searchByLocale(query, "da");

  if (danish.length >= MIN_RESULTS_BEFORE_FALLBACK) {
    return danish;
  }

  const english = await searchByLocale(query, "en").catch(() => [] as ArasaacPictogram[]);

  // Kombinér og fjern dubletter (samme piktogram kan findes i begge søgninger)
  const seenIds = new Set<number>();
  const combined: ArasaacPictogram[] = [];
  for (const pictogram of [...danish, ...english]) {
    const id = pictogramId(pictogram);
    if (id === undefined || seenIds.has(id)) continue;
    seenIds.add(id);
    combined.push(pictogram);
  }
  return combined;
}

const MIN_RESULTS_BEFORE_FALLBACK = 6;

async function searchByLocale(query: string, locale: "da" | "en"): Promise<ArasaacPictogram[]> {
  const res = await fetch(
    `${ARASAAC_API_BASE}/pictograms/${locale}/search/${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error(`ARASAAC-søgning fejlede: ${res.status}`);
  return res.json();
}

/**
 * ARASAAC's API har historisk brugt både "id" og "_id" for piktogram-id'et
 * afhængig af version - denne hjælper er robust over for begge.
 */
export function pictogramId(pictogram: ArasaacPictogram): number | undefined {
  return pictogram._id ?? pictogram.id;
}

/** Samme robusthed for søgeordet der vises under piktogrammet. */
export function pictogramKeyword(pictogram: ArasaacPictogram): string {
  const first = pictogram.keywords?.[0];
  return first?.keyword ?? first?.text ?? "";
}

/** Byg den statiske billed-URL for et givent piktogram-id (denne caches af service workeren). */
export function pictogramImageUrl(pictogramId: string | number, resolution = 500): string {
  return `${ARASAAC_STATIC_BASE}/${pictogramId}/${pictogramId}_${resolution}.png`;
}
