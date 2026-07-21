-- ============================================================
-- Ugeplan PWA - påmindelser/alarmer via web push
-- ============================================================
-- En aktivitet kan markeres til at give en rigtig push-notifikation på
-- det angivne klokkeslæt (fx til medicin) - virker selv når appen ikke
-- er åben, ligesom notifikationer fra andre apps.
-- ============================================================

alter table activities add column reminder_enabled boolean not null default false;
alter table activities add column reminder_sent_at timestamptz;
alter table recurring_activities add column reminder_enabled boolean not null default false;

-- ---------- push_subscriptions ----------
-- Gemmer browserens/enhedens "push-abonnement". En bruger (forælder
-- eller en parret barne-enhed) kan have flere abonnementer, hvis de
-- bruger appen på flere enheder.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_select" on push_subscriptions
  for select using (user_id = auth.uid());

create policy "push_subscriptions_insert" on push_subscriptions
  for insert with check (user_id = auth.uid());

create policy "push_subscriptions_delete" on push_subscriptions
  for delete using (user_id = auth.uid());

-- ============================================================
-- RPC: find alle aktiviteter der skal have en påmindelse sendt LIGE NU
-- (kaldes af send-reminders Edge Function hvert minut - se
-- supabase/functions/send-reminders). SECURITY DEFINER fordi den skal
-- kunne se på tværs af alle familier, kaldes kun af en betroet cron-funktion.
-- ============================================================
create or replace function due_reminders()
returns table (
  activity_id uuid,
  title text,
  child_id uuid,
  family_id uuid
)
language plpgsql
security definer
as $$
begin
  return query
    select a.id, a.title, c.id, c.family_id
    from activities a
    join weekly_plans wp on wp.id = a.weekly_plan_id
    join children c on c.id = wp.child_id
    where a.reminder_enabled = true
      and a.completed_at is null
      and a.reminder_sent_at is null
      and a.time_of_day is not null
      -- dagens ugedag matcher aktivitetens dag (0 = mandag, matcher extract(isodow)-1)
      and a.day_of_week = (extract(isodow from now())::int - 1)
      -- klokkeslættet er indenfor det seneste minut
      and a.time_of_day <= (now() at time zone 'Europe/Copenhagen')::time
      and a.time_of_day > ((now() at time zone 'Europe/Copenhagen') - interval '1 minute')::time
      and wp.week_start_date <= current_date
      and wp.week_start_date > current_date - interval '7 days';
end;
$$;

-- ============================================================
-- RPC: markér at en påmindelse er sendt (undgår dubletter)
-- ============================================================
create or replace function mark_reminder_sent(target_activity_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update activities set reminder_sent_at = now() where id = target_activity_id;
end;
$$;
