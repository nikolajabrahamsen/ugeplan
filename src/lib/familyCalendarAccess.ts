import { supabase } from "./supabaseClient";

/** Henter id'erne på de børn der har adgang til en given familiekalender. */
export async function getCalendarAccess(calendarId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("family_calendar_access")
    .select("child_id")
    .eq("calendar_id", calendarId);
  if (error) throw error;
  return (data ?? []).map((row) => row.child_id);
}

export async function grantCalendarAccess(calendarId: string, childId: string): Promise<void> {
  const { error } = await supabase
    .from("family_calendar_access")
    .insert({ calendar_id: calendarId, child_id: childId });
  if (error) throw error;
}

export async function revokeCalendarAccess(calendarId: string, childId: string): Promise<void> {
  const { error } = await supabase
    .from("family_calendar_access")
    .delete()
    .eq("calendar_id", calendarId)
    .eq("child_id", childId);
  if (error) throw error;
}
