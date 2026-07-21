import { supabase } from "./supabaseClient";
import {
  searchPictograms as searchArasaac,
  pictogramId as arasaacId,
  pictogramKeyword as arasaacKeyword,
  pictogramImageUrl as arasaacImageUrl
} from "./arasaac";

export interface PictogramResult {
  /** Den værdi der gemmes i databasen (fx i activities.pictogram_id) */
  storedValue: string;
  imageUrl: string;
  label: string;
  source: "arasaac" | "opensymbols";
  /** Kun for OpenSymbols-resultater: hvilket underliggende bibliotek (fx "sclera", "mulberry") */
  repoKey?: string;
}

/**
 * Søger piktogrammer på tværs af ARASAAC (direkte, med engelsk fallback -
 * se arasaac.ts) OG OpenSymbols (via en Edge Function, da OpenSymbols
 * kræver at deres "shared secret" aldrig eksponeres i klient-kode).
 * OpenSymbols samler i sig selv flere biblioteker (Sclera, Mulberry m.fl.),
 * så dette ene kald dækker bredt.
 *
 * Hvis OpenSymbols-nøglen endnu ikke er sat op i Supabase (fx mens man
 * venter på at få den godkendt), fejler kun DEN del stille, og man får
 * stadig ARASAAC-resultater - søgningen stopper aldrig helt op af den grund.
 */
export async function searchAllPictograms(query: string): Promise<PictogramResult[]> {
  const [arasaacResults, openSymbolsResults] = await Promise.all([
    searchArasaacResults(query),
    searchOpenSymbolsResults(query).catch(() => [] as PictogramResult[])
  ]);

  return [...arasaacResults, ...openSymbolsResults];
}

async function searchArasaacResults(query: string): Promise<PictogramResult[]> {
  const raw = await searchArasaac(query).catch(() => []);
  return raw
    .filter((p) => arasaacId(p) !== undefined)
    .map((p) => {
      const id = arasaacId(p)!;
      return {
        storedValue: `arasaac:${id}`,
        imageUrl: arasaacImageUrl(id, 300),
        label: arasaacKeyword(p),
        source: "arasaac" as const
      };
    });
}

interface OpenSymbolsRaw {
  image_url: string;
  name: string;
  repo_key?: string;
}

const MIN_RESULTS_BEFORE_FALLBACK = 6;

async function searchOpenSymbolsResults(query: string): Promise<PictogramResult[]> {
  const danish = await searchOpenSymbolsByLocale(query, "da");

  if (danish.length >= MIN_RESULTS_BEFORE_FALLBACK) {
    return danish;
  }

  // Samme problem som med ARASAAC: dansk dækning er tynd, så suppler med
  // en engelsk søgning når det danske resultat er sparsomt
  const english = await searchOpenSymbolsByLocale(query, "en").catch(
    () => [] as PictogramResult[]
  );

  const seen = new Set<string>();
  const combined: PictogramResult[] = [];
  for (const result of [...danish, ...english]) {
    if (seen.has(result.storedValue)) continue;
    seen.add(result.storedValue);
    combined.push(result);
  }
  return combined;
}

async function searchOpenSymbolsByLocale(
  query: string,
  locale: "da" | "en"
): Promise<PictogramResult[]> {
  const { data, error } = await supabase.functions.invoke("search-pictograms", {
    body: { q: query, locale }
  });
  if (error) throw error;

  const raw = (data ?? []) as OpenSymbolsRaw[];
  return raw
    .filter((s) => !!s.image_url)
    .map((s) => ({
      storedValue: `opensymbols:${encodeURIComponent(s.image_url)}`,
      imageUrl: s.image_url,
      label: s.name ?? "",
      source: "opensymbols" as const,
      repoKey: s.repo_key
    }));
}

/**
 * Slår en gemt pictogram_id/avatar-værdi op til en visnings-URL. Håndterer
 * tre former: nye ARASAAC-værdier ("arasaac:2211"), OpenSymbols-værdier
 * ("opensymbols:<url-encoded billed-URL>"), og ÆLDRE data fra før denne
 * ændring, som blot er et rent ARASAAC-tal uden præfiks (fx "2211").
 */
export function resolvePictogramImageUrl(storedValue: string, resolution = 500): string {
  if (storedValue.startsWith("opensymbols:")) {
    return decodeURIComponent(storedValue.slice("opensymbols:".length));
  }
  if (storedValue.startsWith("arasaac:")) {
    return arasaacImageUrl(storedValue.slice("arasaac:".length), resolution);
  }
  // Bagudkompatibilitet: gammel data uden præfiks var altid et ARASAAC-id
  return arasaacImageUrl(storedValue, resolution);
}
