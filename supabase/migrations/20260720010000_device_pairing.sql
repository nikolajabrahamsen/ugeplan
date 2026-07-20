-- ============================================================
-- Ugeplan PWA - device pairing for children's own devices
-- ============================================================
-- Formål: et barns egen iPad/telefon skal kunne have adgang til sin
-- ugeplan UDEN at en forælders fulde konto er logget ind på enheden.
--
-- Løsning: enheden logger ind som en anonym Supabase Auth-bruger
-- (auth.signInAnonymously()) og "parres" til ét bestemt barn via en
-- kort, tidsbegrænset kode som forælderen genererer. Den anonyme
-- bruger får derefter KUN læseadgang til det ene barns ugeplan, samt
-- mulighed for at markere aktiviteter som gjort - intet andet.
--
-- OBS: kræver at "Anonymous sign-ins" er slået til under
-- Authentication -> Sign In / Providers i Supabase Dashboard.
-- ============================================================

-- ---------- children_devices ----------
-- Kobler en anonym auth-bruger (en fysisk enhed) til ét barn
create table children_devices (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text,
  created_at timestamptz not null default now(),
  unique (child_id, user_id)
);

-- ---------- device_pairing_codes ----------
-- Kortlivede koder en forælder genererer, som en enhed indløser én gang
create table device_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table children_devices enable row level security;
alter table device_pairing_codes enable row level security;

-- children_devices: familien kan se og fjerne parrede enheder (fx hvis en iPad mistes)
create policy "children_devices_select" on children_devices
  for select using (
    is_family_member((select family_id from children where id = children_devices.child_id))
  );

create policy "children_devices_delete" on children_devices
  for delete using (
    is_family_member((select family_id from children where id = children_devices.child_id))
  );

-- device_pairing_codes: INGEN direkte adgang for nogen - al adgang går
-- gennem de to SECURITY DEFINER-funktioner nedenfor. RLS uden policies
-- betyder "afvis alt", hvilket er præcis hvad vi vil have her.

-- ============================================================
-- Helper: er den aktuelle bruger en parret enhed for et givent barn?
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

-- ============================================================
-- RPC: generér en parringskode (kaldes af en forælder, fra appen)
-- ============================================================
create or replace function generate_pairing_code(target_child_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  new_code text;
  child_family_id uuid;
begin
  select family_id into child_family_id from children where id = target_child_id;

  if child_family_id is null or not is_family_member(child_family_id) then
    raise exception 'Ikke autoriseret';
  end if;

  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into device_pairing_codes (child_id, code, expires_at)
  values (target_child_id, new_code, now() + interval '10 minutes');

  return new_code;
end;
$$;

-- ============================================================
-- RPC: indløs en parringskode (kaldes af barnets enhed, som allerede
-- er logget ind anonymt via supabase.auth.signInAnonymously())
-- ============================================================
create or replace function redeem_pairing_code(input_code text)
returns uuid
language plpgsql
security definer
as $$
declare
  matched_child_id uuid;
begin
  select child_id into matched_child_id
  from device_pairing_codes
  where code = upper(input_code)
    and used_at is null
    and expires_at > now();

  if matched_child_id is null then
    raise exception 'Ugyldig eller udløbet kode';
  end if;

  update device_pairing_codes set used_at = now() where code = upper(input_code);

  insert into children_devices (child_id, user_id)
  values (matched_child_id, auth.uid())
  on conflict (child_id, user_id) do nothing;

  return matched_child_id;
end;
$$;

-- ============================================================
-- RPC: markér en aktivitet som gjort/ikke gjort. Bruges af BÅDE
-- forældre og parrede enheder, så en parret enhed aldrig får en
-- generel UPDATE-rettighed på activities (kun denne ene, snævre handling).
-- ============================================================
create or replace function toggle_activity_completed(target_activity_id uuid)
returns timestamptz
language plpgsql
security definer
as $$
declare
  target_child_id uuid;
  target_family_id uuid;
  current_completed timestamptz;
  new_completed timestamptz;
begin
  select c.id, c.family_id, a.completed_at
    into target_child_id, target_family_id, current_completed
  from activities a
  join weekly_plans wp on wp.id = a.weekly_plan_id
  join children c on c.id = wp.child_id
  where a.id = target_activity_id;

  if target_child_id is null then
    raise exception 'Aktivitet ikke fundet';
  end if;

  if not (is_family_member(target_family_id) or is_child_device(target_child_id)) then
    raise exception 'Ikke autoriseret';
  end if;

  new_completed := case when current_completed is null then now() else null end;

  update activities set completed_at = new_completed where id = target_activity_id;

  return new_completed;
end;
$$;

-- ============================================================
-- Udvid RLS på eksisterende tabeller, så parrede enheder kan LÆSE
-- (men ikke redigere) deres eget barns data. Redigering sker udelukkende
-- gennem toggle_activity_completed ovenfor.
-- ============================================================
create policy "children_select_device" on children
  for select using (is_child_device(id));

create policy "weekly_plans_select_device" on weekly_plans
  for select using (is_child_device(child_id));

create policy "activities_select_device" on activities
  for select using (
    exists (
      select 1 from weekly_plans wp
      where wp.id = activities.weekly_plan_id
        and is_child_device(wp.child_id)
    )
  );
