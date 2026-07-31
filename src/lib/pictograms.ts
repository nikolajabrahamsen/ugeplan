import { supabase } from "./supabaseClient";
import {
  searchPictograms as searchArasaac,
  pictogramId as arasaacId,
  pictogramKeyword as arasaacKeyword,
  pictogramImageUrl as arasaacImageUrl
} from "./arasaac";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const CUSTOM_PICTOGRAMS_BUCKET = "custom-pictograms";

export interface PictogramResult {
  /** Den værdi der gemmes i databasen (fx i activities.pictogram_id) */
  storedValue: string;
  imageUrl: string;
  label: string;
  source: "arasaac" | "opensymbols" | "custom";
  /** Kun for OpenSymbols-resultater: hvilket underliggende bibliotek (fx "sclera", "mulberry") */
  repoKey?: string;
  /** Kun for egne uploads: er dette delt med alle, eller kun ens egen familie? */
  isPublic?: boolean;
}

/**
 * Søger piktogrammer på tværs af ARASAAC, OpenSymbols (Sclera, Mulberry
 * m.fl.) OG familiens eget bibliotek af uploadede billeder (kræver
 * familyId - udelades søgningen i det, hvis den ikke er kendt endnu).
 *
 * Hvis en enkelt kilde fejler (fx OpenSymbols-nøglen ikke sat op endnu),
 * fejler kun DEN del stille - søgningen stopper aldrig helt op af den grund.
 */
export async function searchAllPictograms(
  query: string,
  familyId?: string
): Promise<PictogramResult[]> {
  const [customResults, arasaacResults, openSymbolsResults] = await Promise.all([
    familyId ? searchCustomPictograms(query, familyId).catch(() => [] as PictogramResult[]) : [],
    searchArasaacResults(query),
    searchOpenSymbolsResults(query).catch(() => [] as PictogramResult[])
  ]);

  return [...customResults, ...arasaacResults, ...openSymbolsResults];
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

function customPictogramImageUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${CUSTOM_PICTOGRAMS_BUCKET}/${storagePath}`;
}

async function searchCustomPictograms(query: string, familyId: string): Promise<PictogramResult[]> {
  const { data, error } = await supabase
    .from("custom_pictograms")
    .select("id, storage_path, label, is_public")
    .or(`family_id.eq.${familyId},is_public.eq.true`)
    .ilike("label", `%${query}%`)
    .limit(24);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    storedValue: `custom:${row.storage_path}`,
    imageUrl: customPictogramImageUrl(row.storage_path),
    label: row.label,
    source: "custom" as const,
    isPublic: row.is_public
  }));
}

/** Uploader et nyt billede til familiens eget piktogram-bibliotek, evt. delt med alle. */
export async function uploadCustomPictogram(
  familyId: string,
  file: File,
  label: string,
  isPublic: boolean
): Promise<PictogramResult> {
  const extension = file.name.split(".").pop() ?? "jpg";
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const storagePath = `${familyId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(CUSTOM_PICTOGRAMS_BUCKET)
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("custom_pictograms").insert({
    family_id: familyId,
    storage_path: storagePath,
    label: label.trim(),
    is_public: isPublic
  });
  if (insertError) throw insertError;

  return {
    storedValue: `custom:${storagePath}`,
    imageUrl: customPictogramImageUrl(storagePath),
    label: label.trim(),
    source: "custom",
    isPublic
  };
}

/**
 * Slår en gemt pictogram_id/avatar-værdi op til en visnings-URL. Håndterer
 * fire former: ARASAAC-værdier ("arasaac:2211"), OpenSymbols-værdier
 * ("opensymbols:<url-encoded billed-URL>"), familiens egne uploads
 * ("custom:<family_id>/<filnavn>"), og ÆLDRE data fra før dette system,
 * som blot er et rent ARASAAC-tal uden præfiks (fx "2211").
 */
export function resolvePictogramImageUrl(storedValue: string, resolution = 500): string {
  if (storedValue.startsWith("opensymbols:")) {
    return decodeURIComponent(storedValue.slice("opensymbols:".length));
  }
  if (storedValue.startsWith("custom:")) {
    return customPictogramImageUrl(storedValue.slice("custom:".length));
  }
  if (storedValue.startsWith("arasaac:")) {
    return arasaacImageUrl(storedValue.slice("arasaac:".length), resolution);
  }
  // Bagudkompatibilitet: gammel data uden præfiks var altid et ARASAAC-id
  return arasaacImageUrl(storedValue, resolution);
}
