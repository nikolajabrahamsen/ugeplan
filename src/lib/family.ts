import { supabase } from "./supabaseClient";

/**
 * Henter familien den aktuelle bruger er medlem af. Hvis brugeren endnu
 * ikke er medlem af nogen familie, tilslutter eller opretter RPC'en
 * join_or_create_family én atomisk i databasen: den tjekker først om
 * der er en ventende invitation til brugerens email (se
 * migration 20260720030000_multiple_parents.sql), og opretter kun en
 * helt ny familie hvis der ikke er nogen invitation at tilslutte sig.
 */
export async function getOrCreateFamily(): Promise<{ id: string; name: string }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Ikke logget ind");
  }

  const { data: family, error: familyError } = await supabase
    .rpc("join_or_create_family", { family_name: "Vores familie" })
    .single();

  if (familyError || !family) throw familyError ?? new Error("Kunne ikke hente familie");

  return family as { id: string; name: string };
}

export interface FamilyParent {
  user_id: string;
  email: string;
  display_name: string | null;
  joined_at: string;
}

/** Henter listen af forældre i familien (til visning i dashboardet). */
export async function listFamilyParents(familyId: string): Promise<FamilyParent[]> {
  const { data, error } = await supabase.rpc("list_family_parents", {
    target_family_id: familyId
  });
  if (error) throw error;
  return (data ?? []) as FamilyParent[];
}

/** Sætter den aktuelle brugers eget visningsnavn i familien. */
export async function setOwnDisplayName(familyId: string, displayName: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Ikke logget ind");

  const { error } = await supabase
    .from("family_members")
    .update({ display_name: displayName.trim() || null })
    .eq("family_id", familyId)
    .eq("user_id", userData.user.id);
  if (error) throw error;
}

/** Inviterer en anden forælder til familien ved email. */
export async function inviteParent(familyId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc("invite_parent", {
    target_family_id: familyId,
    invite_email: email
  });
  if (error) throw error;
}

/** Fjerner en forælder fra familien. Kan ikke fjerne den sidste tilbageværende forælder. */
export async function removeParent(familyId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_family_member", {
    target_family_id: familyId,
    target_user_id: userId
  });
  if (error) throw error;
}
