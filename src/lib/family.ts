import { supabase } from "./supabaseClient";

/**
 * Henter familien den aktuelle bruger er medlem af. Hvis brugeren endnu
 * ikke er medlem af nogen familie (fx allerførste login), oprettes en ny
 * familie via RPC'en create_family, som opretter families- og
 * family_members-rækken atomisk i databasen (se migration
 * 20260720020000_fix_family_creation.sql for hvorfor det skal ske i ét
 * atomisk skridt, og ikke to separate insert-kald fra klienten).
 */
export async function getOrCreateFamily(): Promise<{ id: string; name: string }> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Ikke logget ind");
  }

  const { data: existing, error: existingError } = await supabase
    .from("family_members")
    .select("family_id, families(id, name)")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.families) {
    const family = existing.families as unknown as { id: string; name: string };
    return family;
  }

  // Ingen familie endnu - opret én atomisk via RPC
  const { data: newFamily, error: familyError } = await supabase
    .rpc("create_family", { family_name: "Vores familie" })
    .single();

  if (familyError || !newFamily) throw familyError ?? new Error("Kunne ikke oprette familie");

  return newFamily as { id: string; name: string };
}
