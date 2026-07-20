-- ============================================================
-- Ugeplan PWA - fjern en forælder fra familien
-- ============================================================

create or replace function remove_family_member(target_family_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  member_count int;
begin
  if not is_family_member(target_family_id) then
    raise exception 'Ikke autoriseret';
  end if;

  select count(*) into member_count from family_members where family_id = target_family_id;

  if member_count <= 1 then
    raise exception 'Kan ikke fjerne den sidste forælder fra familien';
  end if;

  delete from family_members
  where family_id = target_family_id and user_id = target_user_id;
end;
$$;
