-- ============================================================
-- Ugeplan PWA - initial schema + RLS
-- ============================================================
-- Design:
--   auth.users (Supabase Auth)      -> forældre logger ind her
--   families                        -> en familie-enhed
--   family_members                  -> kobler auth.users til en family (rolle: 'parent')
--   children                        -> børn i familien (INGEN egen auth.users-konto)
--   weekly_plans                    -> en uge for et barn
--   activities                      -> piktogram + titel pr. dag i ugen
--
-- Adgangsmodel:
--   En bruger kan kun se/redigere data for familier de er medlem af.
--   Børn har ingen login - de tilgås via forælderens session (PIN/profilvalg i klienten).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- families ----------
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------- family_members ----------
-- Kobler en Supabase Auth-bruger (forælder) til en familie
create table family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'parent' check (role in ('parent')),
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

-- ---------- children ----------
create table children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  birth_year int,
  avatar_pictogram_id text,
  pin_code text, -- valgfri simpel PIN til profilvalg i børne-visning (hashes i praksis via edge function)
  created_at timestamptz not null default now()
);

-- ---------- weekly_plans ----------
create table weekly_plans (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  week_start_date date not null, -- mandag i den pågældende uge
  created_at timestamptz not null default now(),
  unique (child_id, week_start_date)
);

-- ---------- activities ----------
create table activities (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = mandag
  pictogram_id text not null,   -- ARASAAC pictogram id
  title text not null,
  sort_order int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_family_members_user on family_members(user_id);
create index idx_children_family on children(family_id);
create index idx_weekly_plans_child on weekly_plans(child_id);
create index idx_activities_plan on activities(weekly_plan_id);

-- ============================================================
-- Helper: er den aktuelle bruger medlem af en given familie?
-- ============================================================
create or replace function is_family_member(target_family_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from family_members
    where family_id = target_family_id
      and user_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table families enable row level security;
alter table family_members enable row level security;
alter table children enable row level security;
alter table weekly_plans enable row level security;
alter table activities enable row level security;

-- families: kun medlemmer kan se/redigere deres egen familie
create policy "families_select" on families
  for select using (is_family_member(id));

create policy "families_update" on families
  for update using (is_family_member(id));

create policy "families_insert" on families
  for insert with check (true); -- oprettes typisk via en edge function der også opretter family_members-rækken

-- family_members: kun medlemmer af familien kan se listen; kun sig selv kan man ikke slette (håndteres via edge function ved behov)
create policy "family_members_select" on family_members
  for select using (is_family_member(family_id));

create policy "family_members_insert" on family_members
  for insert with check (is_family_member(family_id) or not exists (
    select 1 from family_members where family_id = family_members.family_id
  ));

-- children: kun medlemmer af familien
create policy "children_select" on children
  for select using (is_family_member(family_id));

create policy "children_insert" on children
  for insert with check (is_family_member(family_id));

create policy "children_update" on children
  for update using (is_family_member(family_id));

create policy "children_delete" on children
  for delete using (is_family_member(family_id));

-- weekly_plans: adgang via barnets familie
create policy "weekly_plans_select" on weekly_plans
  for select using (
    exists (
      select 1 from children c
      where c.id = weekly_plans.child_id
        and is_family_member(c.family_id)
    )
  );

create policy "weekly_plans_insert" on weekly_plans
  for insert with check (
    exists (
      select 1 from children c
      where c.id = weekly_plans.child_id
        and is_family_member(c.family_id)
    )
  );

create policy "weekly_plans_update" on weekly_plans
  for update using (
    exists (
      select 1 from children c
      where c.id = weekly_plans.child_id
        and is_family_member(c.family_id)
    )
  );

create policy "weekly_plans_delete" on weekly_plans
  for delete using (
    exists (
      select 1 from children c
      where c.id = weekly_plans.child_id
        and is_family_member(c.family_id)
    )
  );

-- activities: adgang via ugeplanens barn -> familie
create policy "activities_select" on activities
  for select using (
    exists (
      select 1 from weekly_plans wp
      join children c on c.id = wp.child_id
      where wp.id = activities.weekly_plan_id
        and is_family_member(c.family_id)
    )
  );

create policy "activities_insert" on activities
  for insert with check (
    exists (
      select 1 from weekly_plans wp
      join children c on c.id = wp.child_id
      where wp.id = activities.weekly_plan_id
        and is_family_member(c.family_id)
    )
  );

create policy "activities_update" on activities
  for update using (
    exists (
      select 1 from weekly_plans wp
      join children c on c.id = wp.child_id
      where wp.id = activities.weekly_plan_id
        and is_family_member(c.family_id)
    )
  );

create policy "activities_delete" on activities
  for delete using (
    exists (
      select 1 from weekly_plans wp
      join children c on c.id = wp.child_id
      where wp.id = activities.weekly_plan_id
        and is_family_member(c.family_id)
    )
  );
