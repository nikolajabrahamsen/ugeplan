-- ============================================================
-- Ugeplan PWA - ret RLS "hønen-og-ægget"-problem ved familieoprettelse
-- ============================================================
-- Tidligere blev en familie oprettet i to separate kald fra klienten:
-- 1) insert i families, 2) insert i family_members. Men RLS-policyen
-- "families_select" kræver at man allerede ER medlem af familien for
-- at måtte SE den - hvilket fejler lige efter trin 1, før trin 2 er
-- nået at køre (PostgREST's .select().single() efter en insert
-- håndhæver SELECT-policyen, ikke kun INSERT-policyen).
--
-- Løsningen: lav begge trin atomisk i én SECURITY DEFINER-funktion,
-- så RLS aldrig ser en "halvfærdig" tilstand.
-- ============================================================

create or replace function create_family(family_name text default 'Vores familie')
returns families
language plpgsql
security definer
as $$
declare
  new_family families;
begin
  insert into families (name) values (family_name)
  returning * into new_family;

  insert into family_members (family_id, user_id, role)
  values (new_family.id, auth.uid(), 'parent');

  return new_family;
end;
$$;
