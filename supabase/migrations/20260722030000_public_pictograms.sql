-- ============================================================
-- Ugeplan PWA - offentligt delte piktogrammer
-- ============================================================
-- Et uploadet piktogram kan nu markeres som "delt med alle" i stedet
-- for kun synligt for ens egen familie - relevant fx til ting som
-- spejder-piktogrammer, som mangler i ARASAAC/OpenSymbols, og som
-- andre brugere af appen også kan få glæde af.
-- ============================================================

alter table custom_pictograms add column is_public boolean not null default false;

drop policy if exists "custom_pictograms_select" on custom_pictograms;

create policy "custom_pictograms_select" on custom_pictograms
  for select using (is_family_member(family_id) or is_public = true);
