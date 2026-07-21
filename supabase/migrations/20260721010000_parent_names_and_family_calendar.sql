-- ============================================================
-- Ugeplan PWA - navne på forældre + familiekalender
-- ============================================================
-- 1) Forældre kan sætte deres eget navn, i stedet for kun at blive vist
--    ved deres email i forældre-listen.
-- 2) En familie kan oprette en "familiekalender" - teknisk set bare en
--    almindelig "children"-række, markeret med is_family_calendar. Det
--    genbruger alt eksisterende infrastruktur (ugeplan, gentagelser,
--    enheds-parring, redigering) uden ændringer andre steder, og kan
--    vælges på samme profilvalgs-skærm som børnene, eller parres til en
--    fælles iPad for sig selv.
-- ============================================================

alter table family_members add column display_name text;
alter table children add column is_family_calendar boolean not null default false;

-- ============================================================
-- Opdatér list_family_parents så den også returnerer display_name
-- ============================================================
create or replace function list_family_parents(target_family_id uuid)
returns table (user_id uuid, email text, display_name text, joined_at timestamptz)
language plpgsql
security definer
as $$
begin
  if not is_family_member(target_family_id) then
    raise exception 'Ikke autoriseret';
  end if;

  return query
    select fm.user_id, u.email::text, fm.display_name, fm.created_at
    from family_members fm
    join auth.users u on u.id = fm.user_id
    where fm.family_id = target_family_id
    order by fm.created_at;
end;
$$;

-- ============================================================
-- Tillader en bruger at opdatere SIN EGEN family_members-række (kun
-- nødvendigt for display_name - der har hidtil ikke været nogen
-- UPDATE-policy overhovedet på denne tabel).
-- ============================================================
create policy "family_members_update_self" on family_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
