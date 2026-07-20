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

/** Inviterer en anden forælder til familien ved email. */
export async function inviteParent(familyId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc("invite_parent", {
    target_family_id: familyId,
    invite_email: email
  });
  if (error) throw error;
}
