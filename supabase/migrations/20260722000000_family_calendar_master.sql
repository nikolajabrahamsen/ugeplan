-- ============================================================
-- Ugeplan PWA - familiekalenderen bliver "master"
-- ============================================================
-- Stor omlægning: i stedet for at hvert barn har sin egen adskilte
-- "uge" (weekly_plans + activities, låst til day_of_week 0-6), ligger
-- ALT nu i én fælles begivenheds-tabel pr. familie, med en RIGTIG
-- kalenderdato. Hver begivenhed markeres med hvem den gælder for: ét
-- eller flere bestemte børn, eller "hele familien".
--
-- Børnenes egen visning bliver et rullende 7-dages vindue (i dag + 6
-- dage frem) der henter begivenheder fra denne fælles tabel - både
-- deres egne og de familie-brede. Familiekalenderen selv får fuld
-- måned/år-navigation, som en rigtig kalender.
--
-- Den gamle "familiekalender som en slags barn"-model (is_family_calendar
-- på children, family_calendar_access) forsvinder helt - den er ikke
-- nødvendig længere, da familie-kalenderen nu er selve grundlaget alt
-- andet er bygget på, ikke en separat profil man vælger.
--
-- Al eksisterende data konverteres automatisk til den nye model.
-- ============================================================

-- ============================================================
-- Nye tabeller
-- ============================================================

create table events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  pictogram_id text not null,
  title text not null,
  event_date date not null,
  time_of_day time,
  reminder_enabled boolean not null default false,
  reminder_sent_at timestamptz,
  applies_to_family boolean not null default false,
  completed_at timestamptz,
  recurring_event_id uuid, -- sat som reference efter recurring_events er oprettet nedenfor
  created_at timestamptz not null default now()
);

create table event_children (
  event_id uuid not null references events(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  primary key (event_id, child_id)
);

create table recurring_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  pictogram_id text not null,
  title text not null,
  time_of_day time,
  days_of_week int[] not null,
  applies_to_family boolean not null default false,
  reminder_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  legacy_recurring_activity_id uuid -- kun brugt til datakonvertering, fjernes til sidst
);

create table recurring_event_children (
  recurring_event_id uuid not null references recurring_events(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  primary key (recurring_event_id, child_id)
);

alter table events add constraint events_recurring_event_id_fkey
  foreign key (recurring_event_id) references recurring_events(id) on delete set null;

create index idx_events_family_date on events(family_id, event_date);
create index idx_event_children_child on event_children(child_id);

-- ============================================================
-- Datakonvertering: gamle recurring_activities -> nye recurring_events
-- ============================================================

insert into recurring_events (
  family_id, pictogram_id, title, time_of_day, days_of_week,
  applies_to_family, reminder_enabled, active, created_at, legacy_recurring_activity_id
)
select
  c.family_id,
  ra.pictogram_id,
  ra.title,
  ra.time_of_day,
  ra.days_of_week,
  coalesce(c.is_family_calendar, false),
  ra.reminder_enabled,
  ra.active,
  ra.created_at,
  ra.id
from recurring_activities ra
join children c on c.id = ra.child_id;

-- Kobl ikke-familie-brede skabeloner til det bestemte barn de hørte til
insert into recurring_event_children (recurring_event_id, child_id)
select re.id, ra.child_id
from recurring_activities ra
join recurring_events re on re.legacy_recurring_activity_id = ra.id
join children c on c.id = ra.child_id
where coalesce(c.is_family_calendar, false) = false;

-- ============================================================
-- Datakonvertering: gamle activities (via weekly_plans) -> nye events
-- ============================================================

insert into events (
  family_id, pictogram_id, title, event_date, time_of_day,
  reminder_enabled, reminder_sent_at, applies_to_family, completed_at,
  recurring_event_id, created_at
)
select
  c.family_id,
  a.pictogram_id,
  a.title,
  wp.week_start_date + (a.day_of_week || ' days')::interval,
  a.time_of_day,
  a.reminder_enabled,
  a.reminder_sent_at,
  coalesce(c.is_family_calendar, false),
  a.completed_at,
  re.id,
  a.created_at
from activities a
join weekly_plans wp on wp.id = a.weekly_plan_id
join children c on c.id = wp.child_id
left join recurring_events re on re.legacy_recurring_activity_id = a.recurring_activity_id;

-- Kobl ikke-familie-brede begivenheder til det bestemte barn de hørte til
insert into event_children (event_id, child_id)
select e.id, wp.child_id
from activities a
join weekly_plans wp on wp.id = a.weekly_plan_id
join children c on c.id = wp.child_id
join events e on
  e.family_id = c.family_id
  and e.title = a.title
  and e.event_date = wp.week_start_date + (a.day_of_week || ' days')::interval
  and e.created_at = a.created_at
where coalesce(c.is_family_calendar, false) = false;

-- Ryd op i de midlertidige kolonner der kun var til konverteringen
alter table recurring_events drop column legacy_recurring_activity_id;

-- ============================================================
-- Slet de children-rækker der var "familiekalender-som-barn" - deres
-- data er nu flyttet til applies_to_family = true events/skabeloner
-- ============================================================
delete from children where is_family_calendar = true;

-- ============================================================
-- Fjern gamle tabeller/kolonner der ikke bruges mere
-- ============================================================
drop function if exists ensure_week_materialized(uuid, date);
drop function if exists due_reminders();
drop function if exists toggle_activity_completed(uuid);

drop table if exists activities;
drop table if exists weekly_plans;
drop table if exists recurring_activities;
drop table if exists family_calendar_access;

alter table children drop column if exists is_family_calendar;

-- ============================================================
-- RLS
-- ============================================================
alter table events enable row level security;
alter table event_children enable row level security;
alter table recurring_events enable row level security;
alter table recurring_event_children enable row level security;

-- Forældre har fuld adgang til deres egen families begivenheder
create policy "events_select_family" on events
  for select using (is_family_member(family_id));
create policy "events_insert_family" on events
  for insert with check (is_family_member(family_id));
create policy "events_update_family" on events
  for update using (is_family_member(family_id));
create policy "events_delete_family" on events
  for delete using (is_family_member(family_id));

create policy "event_children_select_family" on event_children
  for select using (
    exists (select 1 from events e where e.id = event_children.event_id and is_family_member(e.family_id))
  );
create policy "event_children_insert_family" on event_children
  for insert with check (
    exists (select 1 from events e where e.id = event_children.event_id and is_family_member(e.family_id))
  );
create policy "event_children_delete_family" on event_children
  for delete using (
    exists (select 1 from events e where e.id = event_children.event_id and is_family_member(e.family_id))
  );

create policy "recurring_events_select_family" on recurring_events
  for select using (is_family_member(family_id));
create policy "recurring_events_insert_family" on recurring_events
  for insert with check (is_family_member(family_id));
create policy "recurring_events_update_family" on recurring_events
  for update using (is_family_member(family_id));
create policy "recurring_events_delete_family" on recurring_events
  for delete using (is_family_member(family_id));

create policy "recurring_event_children_select_family" on recurring_event_children
  for select using (
    exists (select 1 from recurring_events re where re.id = recurring_event_children.recurring_event_id and is_family_member(re.family_id))
  );
create policy "recurring_event_children_insert_family" on recurring_event_children
  for insert with check (
    exists (select 1 from recurring_events re where re.id = recurring_event_children.recurring_event_id and is_family_member(re.family_id))
  );
create policy "recurring_event_children_delete_family" on recurring_event_children
  for delete using (
    exists (select 1 from recurring_events re where re.id = recurring_event_children.recurring_event_id and is_family_member(re.family_id))
  );

-- Barne-enheder: må SE begivenheder der enten gælder hele familien, eller
-- specifikt er tagget til det barn enheden er parret til
create policy "events_select_device" on events
  for select using (
    exists (
      select 1 from children_devices cd
      join children c on c.id = cd.child_id
      where cd.user_id = auth.uid()
        and c.family_id = events.family_id
        and (
          events.applies_to_family = true
          or exists (
            select 1 from event_children ec
            where ec.event_id = events.id and ec.child_id = cd.child_id
          )
        )
    )
  );

create policy "event_children_select_device" on event_children
  for select using (
    exists (
      select 1 from children_devices cd
      where cd.user_id = auth.uid() and cd.child_id = event_children.child_id
    )
  );

-- ============================================================
-- RPC: materialisér gentagne begivenheder ind i et datointerval.
-- Kaldes af BÅDE forældre (familiekalender-visning) og barne-enheder
-- (rullende 7-dages vindue), derfor SECURITY DEFINER.
-- ============================================================
create or replace function ensure_events_materialized(
  target_family_id uuid,
  range_start date,
  range_end date
)
returns void
language plpgsql
security definer
as $$
declare
  template record;
  d date;
  new_event_id uuid;
begin
  if not (
    is_family_member(target_family_id)
    or exists (
      select 1 from children_devices cd
      join children c on c.id = cd.child_id
      where cd.user_id = auth.uid() and c.family_id = target_family_id
    )
  ) then
    raise exception 'Ikke autoriseret';
  end if;

  for template in
    select * from recurring_events
    where family_id = target_family_id and active
  loop
    d := range_start;
    while d <= range_end loop
      -- 0 = mandag ... 6 = søndag, matcher extract(isodow)-1
      if (extract(isodow from d)::int - 1) = any(template.days_of_week) then
        if not exists (
          select 1 from events
          where recurring_event_id = template.id and event_date = d
        ) then
          insert into events (
            family_id, pictogram_id, title, event_date, time_of_day,
            reminder_enabled, applies_to_family, recurring_event_id
          ) values (
            template.family_id, template.pictogram_id, template.title, d, template.time_of_day,
            template.reminder_enabled, template.applies_to_family, template.id
          )
          returning id into new_event_id;

          if not template.applies_to_family then
            insert into event_children (event_id, child_id)
            select new_event_id, rec.child_id
            from recurring_event_children rec
            where rec.recurring_event_id = template.id;
          end if;
        end if;
      end if;
      d := d + 1;
    end loop;
  end loop;
end;
$$;

-- ============================================================
-- RPC: markér en begivenhed som gjort/ikke gjort. Fælles status for
-- alle den gælder for (ikke pr. barn, for at holde det simpelt at
-- starte med - kan udvides senere hvis det viser sig at give mere
-- mening at hvert barn krydser selvstændigt af).
-- ============================================================
create or replace function toggle_event_completed(target_event_id uuid)
returns timestamptz
language plpgsql
security definer
as $$
declare
  target_family_id uuid;
  current_completed timestamptz;
  new_completed timestamptz;
  is_authorized boolean;
begin
  select family_id, completed_at into target_family_id, current_completed
  from events where id = target_event_id;

  if target_family_id is null then
    raise exception 'Begivenhed ikke fundet';
  end if;

  select
    is_family_member(target_family_id)
    or exists (
      select 1 from children_devices cd
      join children c on c.id = cd.child_id
      where cd.user_id = auth.uid() and c.family_id = target_family_id
    )
  into is_authorized;

  if not is_authorized then
    raise exception 'Ikke autoriseret';
  end if;

  new_completed := case when current_completed is null then now() else null end;
  update events set completed_at = new_completed where id = target_event_id;

  return new_completed;
end;
$$;

-- ============================================================
-- RPC: find begivenheder der skal have en påmindelse sendt LIGE NU.
-- Returtypen er ændret ift. den gamle version (activity_id/child_id ->
-- event_id), så den skal droppes først.
-- ============================================================
drop function if exists due_reminders();

create function due_reminders()
returns table (
  event_id uuid,
  title text,
  family_id uuid
)
language plpgsql
security definer
as $$
begin
  return query
    select e.id, e.title, e.family_id
    from events e
    where e.reminder_enabled = true
      and e.completed_at is null
      and e.reminder_sent_at is null
      and e.time_of_day is not null
      and e.event_date = (now() at time zone 'Europe/Copenhagen')::date
      and e.time_of_day <= (now() at time zone 'Europe/Copenhagen')::time
      and e.time_of_day > ((now() at time zone 'Europe/Copenhagen') - interval '1 minute')::time;
end;
$$;

-- ============================================================
-- RPC: markér at en påmindelse er sendt (undgår dubletter). Erstatter
-- den gamle version som pegede på "activities", der nu er droppet -
-- create or replace kan ikke bruges her fordi parameternavnet ændrer
-- sig, så vi dropper den gamle først.
-- ============================================================
drop function if exists mark_reminder_sent(uuid);

create function mark_reminder_sent(target_event_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update events set reminder_sent_at = now() where id = target_event_id;
end;
$$;

-- ============================================================
-- Ret is_child_device: den refererede family_calendar_access, som er
-- droppet ovenfor. Familiekalender-konceptet er nu indbygget i selve
-- events-modellen (applies_to_family), så den simple, oprindelige
-- version er igen tilstrækkelig.
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
  );
$$;
