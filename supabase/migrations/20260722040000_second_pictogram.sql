-- ============================================================
-- Ugeplan PWA - valgfrit andet piktogram pr. begivenhed
-- ============================================================
-- En begivenhed kan nu have et ekstra, valgfrit piktogram ved siden af
-- det første (fx et generelt "medicin"-symbol + et specifikt billede af
-- selve medicinen). Feltet er nullable, så pladsen til det andet
-- piktogram simpelthen ikke vises, hvis det ikke er sat.
-- ============================================================

alter table events add column pictogram_id_2 text;
alter table recurring_events add column pictogram_id_2 text;

-- ============================================================
-- Opdatér ensure_events_materialized så gentagne begivenheder også
-- får det andet piktogram med, hvis skabelonen har et sat
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
      if (extract(isodow from d)::int - 1) = any(template.days_of_week) then
        if not exists (
          select 1 from events
          where recurring_event_id = template.id and event_date = d
        ) then
          insert into events (
            family_id, pictogram_id, pictogram_id_2, title, event_date, time_of_day,
            reminder_enabled, applies_to_family, recurring_event_id
          ) values (
            template.family_id, template.pictogram_id, template.pictogram_id_2, template.title, d,
            template.time_of_day, template.reminder_enabled, template.applies_to_family, template.id
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
