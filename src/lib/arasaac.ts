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

/** Søg piktogrammer på dansk. Bruges kun i forældre-UI, ikke i børne-visningen. */
export async function searchPictograms(query: string): Promise<ArasaacPictogram[]> {
  const res = await fetch(
    `${ARASAAC_API_BASE}/pictograms/da/search/${encodeURIComponent(query)}`
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
