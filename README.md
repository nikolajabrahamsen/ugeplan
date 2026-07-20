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

## Vigtigt: forældre-login sender en kode, ikke et link

`ParentLogin` bruger `verifyOtp` til at bekræfte en 6-cifret kode, i
stedet for at følge et login-link. Det kræver en ændring i Supabase:

**Authentication → Email Templates → Magic Link** - erstat
`{{ .ConfirmationURL }}` med `{{ .Token }}` i skabelonens indhold, så
mailen indeholder koden i stedet for kun et link. Uden denne ændring
sender Supabase stadig kun et link, og login-koden vil aldrig virke.

Email-koden bruges nu **kun** første gang en forælder logger ind, samt
ved "glemt adgangskode". Efter første login sætter forælderen selv en
adgangskode (mindst 8 tegn), og logger ind med email + adgangskode
derefter - se `ParentLogin.tsx`. Overvej også at sætte **Minimum
password length** til 8 under **Authentication → Policies** i
Supabase, så kravet også håndhæves server-side og ikke kun i appen.

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
