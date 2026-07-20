import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fejler tidligt og tydeligt hvis .env ikke er sat op
  // eslint-disable-next-line no-console
  console.warn(
    "Mangler VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY - kopiér .env.example til .env og udfyld."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
