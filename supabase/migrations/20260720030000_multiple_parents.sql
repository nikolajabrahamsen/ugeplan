-- ============================================================
-- Ugeplan PWA - flere forældre pr. familie (invitationer)
-- ============================================================
-- En eksisterende forælder kan invitere en anden voksen ved email.
-- Når den inviterede logger ind (opretter en Supabase Auth-bruger med
-- den email), bliver de automatisk tilknyttet familien i stedet for at
-- få oprettet deres egen nye familie - se join_or_create_family
-- nedenfor, som erstatter den tidligere create_family-funktion.
-- ============================================================

create table family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (family_id, email)
);

alter table family_invites enable row level security;

-- Kun familiens egne medlemmer kan se/oprette invitationer for deres familie
create policy "family_invites_select" on family_invites
  for select using (is_family_member(family_id));

create policy "family_invites_insert" on family_invites
  for insert with check (is_family_member(family_id));

create policy "family_invites_delete" on family_invites
  for delete using (is_family_member(family_id));

-- ============================================================
-- RPC: inviter en forælder til familien ved email
-- ============================================================
create or replace function invite_parent(target_family_id uuid, invite_email text)
returns void
language plpgsql
security definer
as $$
begin
  if not is_family_member(target_family_id) then
    raise exception 'Ikke autoriseret';
  end if;

  insert into family_invites (family_id, email, invited_by)
  values (target_family_id, lower(trim(invite_email)), auth.uid())
  on conflict (family_id, email) do nothing;
end;
$$;

-- ============================================================
-- RPC: hent egen familie, eller tilslut/opret én. Erstatter
-- create_family - tjekker nu også for ventende invitationer.
-- ============================================================
create or replace function join_or_create_family(family_name text default 'Vores familie')
returns families
language plpgsql
security definer
as $$
declare
  existing_family families;
  pending_invite family_invites;
  new_family families;
  current_email text;
begin
  -- 1) Er brugeren allerede medlem af en familie?
  select f.* into existing_family
  from family_members fm
  join families f on f.id = fm.family_id
  where fm.user_id = auth.uid()
  limit 1;

  if found then
    return existing_family;
  end if;

  -- 2) Er der en ventende invitation til denne brugers email?
  select email into current_email from auth.users where id = auth.uid();

  select fi.* into pending_invite
  from family_invites fi
  where fi.email = lower(current_email)
    and fi.accepted_at is null
  limit 1;

  if found then
    insert into family_members (family_id, user_id, role)
    values (pending_invite.family_id, auth.uid(), 'parent');

    update family_invites set accepted_at = now() where id = pending_invite.id;

    select * into existing_family from families where id = pending_invite.family_id;
    return existing_family;
  end if;

  -- 3) Ellers: opret en ny familie
  insert into families (name) values (family_name)
  returning * into new_family;

  insert into family_members (family_id, user_id, role)
  values (new_family.id, auth.uid(), 'parent');

  return new_family;
end;
$$;

-- ============================================================
-- RPC: se hvem der er forældre i familien (email kan ikke læses
-- direkte fra auth.users af klienten, så dette eksponerer kun det
-- nødvendige, til familiens egne medlemmer)
-- ============================================================
create or replace function list_family_parents(target_family_id uuid)
returns table (user_id uuid, email text, joined_at timestamptz)
language plpgsql
security definer
as $$
begin
  if not is_family_member(target_family_id) then
    raise exception 'Ikke autoriseret';
  end if;

  return query
    select fm.user_id, u.email::text, fm.created_at
    from family_members fm
    join auth.users u on u.id = fm.user_id
    where fm.family_id = target_family_id
    order by fm.created_at;
end;
$$;
