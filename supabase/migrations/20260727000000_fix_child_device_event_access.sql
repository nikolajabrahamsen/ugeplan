-- ============================================================
-- Ugeplan PWA - barne-enheder kunne ikke se nogen begivenheder
-- ============================================================
-- Reglerne for barne-enheder slog selv op i children_devices, men den
-- tabel kan kun læses af forældre (RLS). For en barne-enhed kom opslaget
-- derfor altid tomt tilbage, og alle begivenheder blev skjult.
-- Opslaget flyttes ind i SECURITY DEFINER-funktioner, som må læse
-- children_devices uanset RLS.
-- ============================================================

create or replace function device_can_see_event(target_event_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from events e
    join children c on c.family_id = e.family_id
    join children_devices cd on cd.child_id = c.id
    where e.id = target_event_id
      and cd.user_id = auth.uid()
      and (
        e.applies_to_family = true
        or exists (
          select 1 from event_children ec
          where ec.event_id = e.id and ec.child_id = cd.child_id
        )
      )
  );
$$;

create or replace function device_owns_child(target_child_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from children_devices
    where user_id = auth.uid() and child_id = target_child_id
  );
$$;

drop policy if exists "events_select_device" on events;
create policy "events_select_device" on events
  for select using (device_can_see_event(events.id));

drop policy if exists "event_children_select_device" on event_children;
create policy "event_children_select_device" on event_children
  for select using (device_owns_child(event_children.child_id));
