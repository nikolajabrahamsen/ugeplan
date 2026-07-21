# Ugeplan PWA

Piktogram-baseret ugeplan for børn med udfordringer. Forældre opretter og
redigerer ugens aktiviteter; børn ser en låst, simpel visning med kun den
aktuelle uge, piktogrammer og titler.

## Stak

- **Frontend:** React + TypeScript + Vite, PWA via `vite-plugin-pwa`
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Piktogrammer:** [ARASAAC](https://arasaac.org) (CC BY-NC-SA — tjek licens ift. evt. kommerciel brug)

## Kom i gang

1. Opret et Supabase-projekt (vælg en EU-region, fx Frankfurt).
2. Kør migrationen i `supabase/migrations/0001_init.sql` mod dit projekt
   (via Supabase CLI: `supabase db push`, eller kør SQL'en direkte i
   SQL-editoren i Supabase Studio).
3. Kopiér `.env.example` til `.env` og udfyld `VITE_SUPABASE_URL` og
   `VITE_SUPABASE_ANON_KEY` fra dit Supabase-projekts API-indstillinger.
4. `npm install`
5. `npm run dev`

## Struktur

```
supabase/migrations/   Database-schema + RLS-policies
src/lib/                Supabase-klient og ARASAAC-hjælpefunktioner
src/pages/parent/       Forældre-login og -dashboard
src/pages/child/        Låst børne-visning (profilvalg + ugeplan)
```

## Status / næste skridt

Grundfunktionerne er nu på plads:

- [x] Formular til at oprette børn (`ChildForm`, brugt i `ParentDashboard`)
- [x] Ugeplan-editor (`WeeklyPlanEditor`): vælg dag, søg ARASAAC-piktogram
      via `PictogramPicker`, sæt titel, gem som `activity`
- [x] `onAuthStateChange`-lytter i `ParentLogin`, så login navigerer
      videre til `/parent`
- [x] Route-guard (`RequireAuth`) på `/parent`-ruterne

Det der stadig mangler:

- [x] Route-guard på `/child`-ruterne (accepterer både forældre-session
      og en parret enheds anonyme session)
- [x] Barnets egen enhed kan tilknyttes uden forælderens login, via en
      kortlivet parringskode (`PairingCodeGenerator` hos forælderen,
      `/pair` på barnets enhed) - se migration
      `20260720010000_device_pairing.sql`
- [ ] Rigtige app-ikoner (`public/icon-192.png`, `public/icon-512.png`)
- [ ] Ekstra spærre (PIN) i `ChildProfilePicker`, hvis familien ønsker det
- [ ] Håndtering af flere uger frem/tilbage til redigering (barnet ser
      dog stadig kun den aktuelle uge)
- [ ] Mulighed for at redigere/slette børn og ændre rækkefølgen på
      aktiviteter (kun oprettelse og sletning er understøttet nu)

## Vigtigt: forældre-konti oprettes uden mail

**Authentication → Sign In / Providers → Email** - slå **"Confirm
email"** fra. Uden det kræver Supabase et bekræftelses-mail-flow ved
`signUp()`, som var netop det vi ville væk fra.

Med den slået fra opretter en forælder sin konto direkte i appen
("Opret ny konto" på login-siden): email (bruges kun som login-navn,
skal ikke kunne modtage noget) + en selvvalgt adgangskode på mindst 8
tegn - ingen mail sendes, kontoen er aktiv med det samme.

Email-kode-flowet (`verifyOtp`) bruges nu **kun** som "glemt
adgangskode"-fallback, og kræver stadig at mail-skabelonen er
ændret for at virke i det scenarie:
**Authentication → Email Templates → Magic Link** - erstat
`{{ .ConfirmationURL }}` med `{{ .Token }}`. Fungerer den fallback
ikke (fx pga. mail-leveringsproblemer), er der ingen anden indbygget
vej til at nulstille en glemt adgangskode i øjeblikket - overvej at
tilføje en admin-mulighed for dette senere, hvis det bliver relevant.

Overvej at sætte **Minimum password length** til 8 under
**Authentication → Policies** i Supabase, så kravet håndhæves
server-side og ikke kun i appen.

## Vigtigt: OpenSymbols kræver en Edge Function-hemmelighed

Piktogram-søgningen kombinerer nu ARASAAC (direkte fra klienten) og
OpenSymbols (som selv samler Sclera, Mulberry m.fl.), via Edge
Function'en `supabase/functions/search-pictograms`. OpenSymbols
kræver at deres "shared secret" aldrig eksponeres i klient-kode,
derfor ligger den kun server-side.

**Opsætning:**
1. Ansøg om en shared secret på opensymbols.org/api (manuel godkendelse)
2. `supabase functions deploy search-pictograms`
3. `supabase secrets set OPENSYMBOLS_SECRET=jeres-hemmelighed`

Uden dette fejler kun OpenSymbols-delen af søgningen stille - ARASAAC
virker stadig som hidtil, appen stopper ikke op af den grund.

## Vigtigt: Anonymous sign-ins skal slås til

Enheds-parring (så et barns egen iPad/telefon kan bruges uden en
forælders login) kræver at **Anonymous sign-ins** er aktiveret i jeres
Supabase-projekt: **Authentication → Sign In / Providers → Anonymous
Sign-Ins**. Uden det vil `/pair`-siden fejle.

## GDPR-noter

- Vælg en EU-region i Supabase for at holde børnedata inden for EU.
- `pin_code` i `children`-tabellen bør hashes (fx via en Supabase Edge
  Function) fremfor at gemmes i klartekst, hvis den tages i brug.
- Byg en "slet familie/barn"-funktion tidligt (kan gøres simpelt via
  `on delete cascade`, som allerede er sat op i migrationen).
