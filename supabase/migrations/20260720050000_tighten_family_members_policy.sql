-- ============================================================
-- Ugeplan PWA - stram family_members_insert-policyen
-- ============================================================
-- Den oprindelige policy tillod (som en bootstrap-mekanisme) at en
-- bruger kunne tilslutte sig enhver familie der endnu ingen medlemmer
-- havde. Den mekanisme bruges ikke længere - al familie-oprettelse og
-- -tilslutning sker nu udelukkende gennem join_or_create_family, som
-- kører som SECURITY DEFINER og derfor slet ikke er underlagt RLS.
-- Denne migration fjerner derfor det gamle "tomme familie"-hul, så
-- direkte klient-inserts i family_members kun kan ske hvis man allerede
-- er medlem af familien i forvejen (hvilket reelt betyder: aldrig fra
-- klienten, kun via RPC'en).
-- ============================================================

drop policy if exists "family_members_insert" on family_members;

create policy "family_members_insert" on family_members
  for insert with check (is_family_member(family_id));
