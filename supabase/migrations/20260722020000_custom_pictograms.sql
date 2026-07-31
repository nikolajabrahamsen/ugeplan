-- ============================================================
-- Ugeplan PWA - familiens eget piktogram-bibliotek
-- ============================================================
-- Lader en familie uploade sine egne billeder (fx et rigtigt foto af
-- bedstemor, huset, eller kæledyret) som piktogrammer, der søges
-- samtidig med ARASAAC og OpenSymbols.
--
-- Billederne ligger i en OFFENTLIG storage-bucket (samme princip som
-- ARASAAC/OpenSymbols' egne billed-URL'er - et helt almindeligt <img>
-- kan vise dem uden login), men kun familiens egne medlemmer må
-- uploade eller slette. Stien er navngivet {family_id}/{filnavn}, så
-- adgangsreglerne kan bruge selve mappenavnet til at afgøre ejerskab.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('custom-pictograms', 'custom-pictograms', true)
on conflict (id) do nothing;

create table custom_pictograms (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  storage_path text not null,
  label text not null,
  created_at timestamptz not null default now()
);

alter table custom_pictograms enable row level security;

create policy "custom_pictograms_select" on custom_pictograms
  for select using (is_family_member(family_id));

create policy "custom_pictograms_insert" on custom_pictograms
  for insert with check (is_family_member(family_id));

create policy "custom_pictograms_delete" on custom_pictograms
  for delete using (is_family_member(family_id));

-- ---------- storage.objects RLS for custom-pictograms bucket ----------
-- (storage.foldername(name))[1] er den første del af filstien, dvs.
-- family_id, som vi navngiver filerne efter.

create policy "custom_pictograms_storage_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'custom-pictograms'
    and is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "custom_pictograms_storage_delete" on storage.objects
  for delete
  using (
    bucket_id = 'custom-pictograms'
    and is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "custom_pictograms_storage_select" on storage.objects
  for select
  using (bucket_id = 'custom-pictograms');
