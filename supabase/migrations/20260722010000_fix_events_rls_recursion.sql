-- ============================================================
-- Ugeplan PWA - ret cirkulær RLS mellem events og event_children
-- ============================================================
-- events_select_device kiggede direkte på event_children, og
-- event_children_select_family (m.fl.) kiggede direkte tilbage på
-- events. Når begge tabeller indgår i samme forespørgsel (som når
-- fetchEvents henter events med event_children indlejret), opdager
-- Postgres at de to tabellers regler spørger hinanden i ring, og
-- afviser forespørgslen med "infinite recursion detected" (42P17).
--
-- Løsningen er at pakke de tværgående opslag ind i SECURITY DEFINER-
-- funktioner. Sådanne funktioner kører med forhøjede rettigheder og
-- omgår derved RLS på den tabel de forespørger indefra - præcis som
-- is_family_member() og is_child_device() allerede gør andre steder i
-- appen uden problemer.
-- ============================================================

create or replace function event_has_child_assignment(target_event_id uuid, target_child_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from event_children
    where event_id = target_event_id and child_id = target_child_id
  );
$$;

create or replace function get_event_family_id(target_event_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select family_id from events where id = target_event_id;
$$;

-- ---------- events: brug funktionen i stedet for en direkte subquery ----------
drop policy if exists "events_select_device" on events;

create policy "events_select_device" on events
  for select using (
    exists (
      select 1 from children_devices cd
      join children c on c.id = cd.child_id
      where cd.user_id = auth.uid()
        and c.family_id = events.family_id
        and (events.applies_to_family = true or event_has_child_assignment(events.id, cd.child_id))
    )
  );

-- ---------- event_children: samme princip, den anden vej ----------
drop policy if exists "event_children_select_family" on event_children;
drop policy if exists "event_children_insert_family" on event_children;
drop policy if exists "event_children_delete_family" on event_children;

create policy "event_children_select_family" on event_children
  for select using (is_family_member(get_event_family_id(event_children.event_id)));

create policy "event_children_insert_family" on event_children
  for insert with check (is_family_member(get_event_family_id(event_children.event_id)));

create policy "event_children_delete_family" on event_children
  for delete using (is_family_member(get_event_family_id(event_children.event_id)));
