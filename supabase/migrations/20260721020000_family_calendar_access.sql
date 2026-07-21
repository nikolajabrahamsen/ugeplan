-- ============================================================
-- Ugeplan PWA - styr hvilke børn der har adgang til familiekalenderen
-- ============================================================
-- En forælder kan give (eller fjerne) adgang til familiekalenderen for
-- hvert enkelt barn. Det virker uden at skulle parre enheden om: en
-- barne-enhed er allerede koblet til sit eget barn via children_devices,
-- og denne tabel kobler DET barn videre til hvilke familiekalendere det
-- må se. is_child_device() (som bruges alle steder i RLS) udvides til
-- at kigge efter begge veje.
-- ============================================================

create table family_calendar_access (
  calendar_id uuid not null references children(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (calendar_id, child_id)
);

alter table family_calendar_access enable row level security;

create policy "family_calendar_access_select" on family_calendar_access
  for select using (
    exists (select 1 from children c where c.id = family_calendar_access.calendar_id and is_family_member(c.family_id))
  );

create policy "family_calendar_access_insert" on family_calendar_access
  for insert with check (
    exists (select 1 from children c where c.id = family_calendar_access.calendar_id and is_family_member(c.family_id))
  );

create policy "family_calendar_access_delete" on family_calendar_access
  for delete using (
    exists (select 1 from children c where c.id = family_calendar_access.calendar_id and is_family_member(c.family_id))
  );

-- ============================================================
-- Udvid is_child_device: en enhed har også adgang til en familiekalender
-- hvis det barn enheden er parret til, har fået adgang tildelt af en
-- forælder. Samme funktion bruges allerede i RLS for children,
-- weekly_plans, activities og toggle_activity_completed, så denne ene
-- ændring dækker det hele.
-- ============================================================
create or replace function is_child_device(target_child_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from children_devices
    where child_id = target_child_id
      and user_id = auth.uid()
  )
  or exists (
    select 1
    from children_devices cd
    join family_calendar_access fca on fca.child_id = cd.child_id
    join children fc on fc.id = fca.calendar_id
    where cd.user_id = auth.uid()
      and fca.calendar_id = target_child_id
      and fc.is_family_calendar = true
  );
$$;
