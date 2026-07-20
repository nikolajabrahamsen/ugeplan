-- ============================================================
-- Ugeplan PWA - tidspunkt på aktiviteter
-- ============================================================
-- Aktiviteter kan nu have et valgfrit klokkeslæt, som bruges til at
-- sortere dem inden for dagen (i stedet for kun manuel rækkefølge).
-- ============================================================

alter table activities add column time_of_day time;
