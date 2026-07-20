import { supabase } from "./supabaseClient";

/**
 * Henter familien den aktuelle bruger er medlem af. Hvis brugeren endnu
 * ikke er medlem af nogen familie (fx allerførste login), oprettes en ny
 * familie og brugeren tilføjes som medlem. Se RLS-policies i
 * supabase/migrations - families_insert tillader oprettelse, og
 * family_members_insert tillader at man tilføjer sig selv til en familie
 * der endnu ingen medlemmer har.
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

  // Ingen familie endnu - opret én
  const { data: newFamily, error: familyError } = await supabase
    .from("families")
    .insert({ name: "Vores familie" })
    .select()
    .single();

  if (familyError || !newFamily) throw familyError ?? new Error("Kunne ikke oprette familie");

  const { error: memberError } = await supabase.from("family_members").insert({
    family_id: newFamily.id,
    user_id: userData.user.id,
    role: "parent"
  });

  if (memberError) throw memberError;

  return newFamily;
}
