// Supabase Edge Function: search-pictograms
//
// Proxy til OpenSymbols' API. Formålet er udelukkende at holde
// OPENSYMBOLS_SECRET skjult for browseren - OpenSymbols kræver
// selv eksplicit at "shared secret" aldrig må ligge i frontend-kode
// (se opensymbols.org/api). Klienten kalder derfor denne funktion i
// stedet for OpenSymbols direkte.
//
// Kræver en miljøvariabel sat i Supabase:
//   supabase secrets set OPENSYMBOLS_SECRET=jeres-hemmelighed
//
// Kaldes fra klienten som:
//   supabase.functions.invoke('search-pictograms', { body: { q: 'skole', locale: 'da' } })
//
// Bemærk: funktionen kræver som standard et gyldigt login (Supabase
// verificerer automatisk JWT'en for Edge Functions), så kun forældre
// og parrede enheder kan kalde den - ikke helt ukendte besøgende.

const OPENSYMBOLS_BASE = "https://www.opensymbols.org/api/v2";

// CORS-headers: PÅKRÆVET for at browseren overhovedet vil lade appen
// kalde funktionen. Uden disse virker et direkte curl/PowerShell-kald
// fint (de er ikke underlagt CORS), mens ethvert kald fra selve appen
// i browseren bliver blokeret før det når frem - præcis det mønster
// der opstod her.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  // Browseren sender altid et "preflight" OPTIONS-kald før selve POST'en
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Kun POST er understøttet" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const secret = Deno.env.get("OPENSYMBOLS_SECRET");
  if (!secret) {
    return new Response(
      JSON.stringify({ error: "OPENSYMBOLS_SECRET er ikke sat op i Supabase" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: { q?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ugyldig request-body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const query = body.q?.trim();
  if (!query) {
    return new Response(JSON.stringify({ error: "Mangler søgeterm 'q'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const locale = body.locale ?? "da";

  try {
    // Trin 1: hent en kortlivet access token
    const tokenRes = await fetch(
      `${OPENSYMBOLS_BASE}/token?secret=${encodeURIComponent(secret)}`,
      { method: "POST" }
    );
    if (!tokenRes.ok) {
      throw new Error(`Token-kald fejlede: ${tokenRes.status}`);
    }
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Trin 2: søg piktogrammer på tværs af alle tilkoblede biblioteker
    const searchUrl =
      `${OPENSYMBOLS_BASE}/symbols?q=${encodeURIComponent(query)}` +
      `&locale=${encodeURIComponent(locale)}` +
      `&access_token=${encodeURIComponent(accessToken)}`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      throw new Error(`Søgning fejlede: ${searchRes.status}`);
    }
    const results = await searchRes.json();

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Ukendt fejl" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
