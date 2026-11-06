import { createClient } from "@supabase/supabase-js";

// Valores de contingência evitam que a página falhe durante o build.
// Para usar o banco, configure as duas variáveis reais na hospedagem.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(url, key);
