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

Dette er et skelet, ikke en færdig app. Det der mangler før det er brugbart:

- [ ] Formular til at oprette børn (i `ParentDashboard`)
- [ ] Ugeplan-editor: vælg dag, søg ARASAAC-piktogram (`searchPictograms`
      i `src/lib/arasaac.ts`), sæt titel, gem som `activity`
- [ ] `onAuthStateChange`-lytter i `ParentLogin`, så login faktisk
      navigerer videre til `/parent`
- [ ] Route-guards, så `/parent` og `/child` kræver et aktivt login
- [ ] Rigtige app-ikoner (`public/icon-192.png`, `public/icon-512.png`)
- [ ] Ekstra spærre (PIN) i `ChildProfilePicker`, hvis familien ønsker det
- [ ] Håndtering af flere uger frem/tilbage til redigering (barnet ser
      dog stadig kun den aktuelle uge)

## GDPR-noter

- Vælg en EU-region i Supabase for at holde børnedata inden for EU.
- `pin_code` i `children`-tabellen bør hashes (fx via en Supabase Edge
  Function) fremfor at gemmes i klartekst, hvis den tages i brug.
- Byg en "slet familie/barn"-funktion tidligt (kan gøres simpelt via
  `on delete cascade`, som allerede er sat op i migrationen).
