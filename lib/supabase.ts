import { createClient } from "@supabase/supabase-js";

// Valores temporários evitam erro durante a compilação quando as variáveis
// ainda não foram cadastradas. O banco só funcionará com os valores reais.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(url, key);
