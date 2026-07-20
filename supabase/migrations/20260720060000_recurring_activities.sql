-- ============================================================
-- Ugeplan PWA - gentagne aktiviteter
-- ============================================================
-- En "skabelon" der ikke hører til én bestemt uge, men i stedet
-- angiver hvilke ugedage aktiviteten skal dukke op på (fx alle 7, eller
-- kun mandag/onsdag/fredag). Når en uge åbnes (af en forælder ELLER af
-- barnets enhed), "materialiseres" skabelonen ind som almindelige
-- activities-rækker for netop de dage, hvis de ikke allerede findes -
-- så resten af appen (redigering, fuldførelse osv.) fungerer helt som
-- for enkeltstående aktiviteter bagefter.
-- ============================================================

create table recurring_activities (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  pictogram_id text not null,
  title text not null,
  time_of_day time,
  days_of_week int[] not null, -- 0 = mandag ... 6 = søndag, matcher activities.day_of_week
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table activities
  add column recurring_activity_id uuid references recurring_activities(id) on delete set null;

alter table recurring_activities enable row level security;

create policy "recurring_activities_select" on recurring_activities
  for select using (
    exists (select 1 from children c where c.id = recurring_activities.child_id and is_family_member(c.family_id))
  );

create policy "recurring_activities_insert" on recurring_activities
  for insert with check (
    exists (select 1 from children c where c.id = recurring_activities.child_id and is_family_member(c.family_id))
  );

create policy "recurring_activities_update" on recurring_activities
  for update using (
    exists (select 1 from children c where c.id = recurring_activities.child_id and is_family_member(c.family_id))
  );

create policy "recurring_activities_delete" on recurring_activities
  for delete using (
    exists (select 1 from children c where c.id = recurring_activities.child_id and is_family_member(c.family_id))
  );

-- ============================================================
-- RPC: find eller opret ugeplanen for en given uge, og materialisér
-- eventuelle gentagne aktiviteter ind i den. Kaldes af BÅDE forældre og
-- parrede barne-enheder, derfor SECURITY DEFINER (en enhed har ikke
-- selv ret til at indsætte i activities direkte).
-- ============================================================
create or replace function ensure_week_materialized(target_child_id uuid, week_start date)
returns uuid
language plpgsql
security definer
as $$
declare
  target_family_id uuid;
  plan_id uuid;
  template record;
  day int;
  next_sort_order int;
begin
  select family_id into target_family_id from children where id = target_child_id;

  if not (is_family_member(target_family_id) or is_child_device(target_child_id)) then
    raise exception 'Ikke autoriseret';
  end if;

  select id into plan_id from weekly_plans
  where child_id = target_child_id and week_start_date = week_start;

  if plan_id is null then
    insert into weekly_plans (child_id, week_start_date)
    values (target_child_id, week_start)
    returning id into plan_id;
  end if;

  for template in
    select * from recurring_activities
    where child_id = target_child_id and active
  loop
    foreach day in array template.days_of_week
    loop
      if not exists (
        select 1 from activities
        where weekly_plan_id = plan_id
          and recurring_activity_id = template.id
          and day_of_week = day
      ) then
        select coalesce(max(sort_order), -1) + 1 into next_sort_order
        from activities
        where weekly_plan_id = plan_id and day_of_week = day;

        insert into activities (
          weekly_plan_id, day_of_week, pictogram_id, title, sort_order, time_of_day, recurring_activity_id
        ) values (
          plan_id, day, template.pictogram_id, template.title, next_sort_order, template.time_of_day, template.id
        );
      end if;
    end loop;
  end loop;

  return plan_id;
end;
$$;
