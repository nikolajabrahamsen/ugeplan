import { supabase } from "./supabaseClient";

export interface CalendarChild {
  id: string;
  name: string;
  avatar_pictogram_id: string | null;
}

export interface CalendarEvent {
  id: string;
  event_date: string; // "YYYY-MM-DD"
  pictogram_id: string;
  title: string;
  time_of_day: string | null;
  reminder_enabled: boolean;
  applies_to_family: boolean;
  completed_at: string | null;
  recurring_event_id: string | null;
  child_ids: string[]; // tomt hvis applies_to_family er true
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Henter alle "rigtige" børn i familien (bruges til tildeling og listen på dashboardet). */
export async function listChildren(familyId: string): Promise<CalendarChild[]> {
  const { data, error } = await supabase
    .from("children")
    .select("id, name, avatar_pictogram_id")
    .eq("family_id", familyId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/** Sørger for at gentagne begivenheder er lagt ind som konkrete datoer i intervallet. */
export async function ensureEventsMaterialized(
  familyId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<void> {
  const { error } = await supabase.rpc("ensure_events_materialized", {
    target_family_id: familyId,
    range_start: toDateStr(rangeStart),
    range_end: toDateStr(rangeEnd)
  });
  if (error) throw error;
}

/** Henter begivenheder i et datointerval, inklusiv hvilke børn hver af dem gælder for. */
export async function fetchEvents(
  familyId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, event_date, pictogram_id, title, time_of_day, reminder_enabled, applies_to_family, completed_at, recurring_event_id, event_children(child_id)"
    )
    .eq("family_id", familyId)
    .gte("event_date", toDateStr(rangeStart))
    .lte("event_date", toDateStr(rangeEnd))
    .order("event_date")
    .order("time_of_day", { nullsFirst: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    child_ids: (row.event_children as { child_id: string }[]).map((c) => c.child_id)
  }));
}

export interface EventInput {
  familyId: string;
  pictogramId: string;
  title: string;
  timeOfDay: string | null;
  reminderEnabled: boolean;
  appliesToFamily: boolean;
  childIds: string[];
}

/** Opretter en enkeltstående begivenhed på én bestemt dato. */
export async function createEvent(input: EventInput & { eventDate: Date }): Promise<void> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      family_id: input.familyId,
      pictogram_id: input.pictogramId,
      title: input.title,
      event_date: toDateStr(input.eventDate),
      time_of_day: input.timeOfDay,
      reminder_enabled: input.reminderEnabled,
      applies_to_family: input.appliesToFamily
    })
    .select()
    .single();
  if (error) throw error;

  if (!input.appliesToFamily && input.childIds.length > 0) {
    const { error: childrenError } = await supabase
      .from("event_children")
      .insert(input.childIds.map((childId) => ({ event_id: data.id, child_id: childId })));
    if (childrenError) throw childrenError;
  }
}

/** Opretter en gentagelses-skabelon (materialiseres ind i kalenderen efterhånden). */
export async function createRecurringEvent(
  input: EventInput & { daysOfWeek: number[] }
): Promise<void> {
  const { data, error } = await supabase
    .from("recurring_events")
    .insert({
      family_id: input.familyId,
      pictogram_id: input.pictogramId,
      title: input.title,
      time_of_day: input.timeOfDay,
      days_of_week: input.daysOfWeek,
      applies_to_family: input.appliesToFamily,
      reminder_enabled: input.reminderEnabled
    })
    .select()
    .single();
  if (error) throw error;

  if (!input.appliesToFamily && input.childIds.length > 0) {
    const { error: childrenError } = await supabase
      .from("recurring_event_children")
      .insert(input.childIds.map((childId) => ({ recurring_event_id: data.id, child_id: childId })));
    if (childrenError) throw childrenError;
  }
}

/** Redigér kun denne ene forekomst af en begivenhed. */
export async function updateEvent(
  eventId: string,
  changes: { pictogramId: string; title: string; timeOfDay: string | null; reminderEnabled: boolean }
): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({
      pictogram_id: changes.pictogramId,
      title: changes.title,
      time_of_day: changes.timeOfDay,
      reminder_enabled: changes.reminderEnabled
    })
    .eq("id", eventId);
  if (error) throw error;
}

/** Redigér ALLE forekomster af en gentaget begivenhed (skabelonen + allerede-lagte datoer). */
export async function updateAllOccurrences(
  recurringEventId: string,
  changes: { pictogramId: string; title: string; timeOfDay: string | null; reminderEnabled: boolean }
): Promise<void> {
  const { error: templateError } = await supabase
    .from("recurring_events")
    .update({
      pictogram_id: changes.pictogramId,
      title: changes.title,
      time_of_day: changes.timeOfDay,
      reminder_enabled: changes.reminderEnabled
    })
    .eq("id", recurringEventId);
  if (templateError) throw templateError;

  const { error: instancesError } = await supabase
    .from("events")
    .update({
      pictogram_id: changes.pictogramId,
      title: changes.title,
      time_of_day: changes.timeOfDay,
      reminder_enabled: changes.reminderEnabled
    })
    .eq("recurring_event_id", recurringEventId);
  if (instancesError) throw instancesError;
}

/** Ændrer hvem en enkeltstående begivenhed gælder for (bruges ved redigering). */
export async function setEventChildren(
  eventId: string,
  appliesToFamily: boolean,
  childIds: string[]
): Promise<void> {
  const { error: updateError } = await supabase
    .from("events")
    .update({ applies_to_family: appliesToFamily })
    .eq("id", eventId);
  if (updateError) throw updateError;

  const { error: deleteError } = await supabase
    .from("event_children")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) throw deleteError;

  if (!appliesToFamily && childIds.length > 0) {
    const { error: insertError } = await supabase
      .from("event_children")
      .insert(childIds.map((childId) => ({ event_id: eventId, child_id: childId })));
    if (insertError) throw insertError;
  }
}

/** Gør en allerede-eksisterende enkeltstående begivenhed til starten på en gentagelse. */
export async function promoteEventToRecurring(
  eventId: string,
  input: EventInput & { daysOfWeek: number[] }
): Promise<void> {
  const { data: recurring, error: recurringError } = await supabase
    .from("recurring_events")
    .insert({
      family_id: input.familyId,
      pictogram_id: input.pictogramId,
      title: input.title,
      time_of_day: input.timeOfDay,
      days_of_week: input.daysOfWeek,
      applies_to_family: input.appliesToFamily,
      reminder_enabled: input.reminderEnabled
    })
    .select()
    .single();
  if (recurringError) throw recurringError;

  if (!input.appliesToFamily && input.childIds.length > 0) {
    const { error: childrenError } = await supabase
      .from("recurring_event_children")
      .insert(input.childIds.map((childId) => ({ recurring_event_id: recurring.id, child_id: childId })));
    if (childrenError) throw childrenError;
  }

  const { error: linkError } = await supabase
    .from("events")
    .update({
      recurring_event_id: recurring.id,
      pictogram_id: input.pictogramId,
      title: input.title,
      time_of_day: input.timeOfDay,
      reminder_enabled: input.reminderEnabled,
      applies_to_family: input.appliesToFamily
    })
    .eq("id", eventId);
  if (linkError) throw linkError;

  await setEventChildren(eventId, input.appliesToFamily, input.childIds);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

/** Stopper en gentagelse fremover - allerede lagte datoer bliver stående som almindelige begivenheder. */
export async function stopRecurringEvent(recurringEventId: string): Promise<void> {
  const { error } = await supabase
    .from("recurring_events")
    .update({ active: false })
    .eq("id", recurringEventId);
  if (error) throw error;
}

export async function toggleEventCompleted(eventId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("toggle_event_completed", {
    target_event_id: eventId
  });
  if (error) throw error;
  return data as string | null;
}
