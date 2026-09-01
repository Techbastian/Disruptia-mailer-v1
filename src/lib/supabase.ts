import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabaseUrl = rawSupabaseUrl.startsWith("http") ? rawSupabaseUrl : rawSupabaseUrl ? `https://${rawSupabaseUrl}` : "";

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const SUPABASE_BUCKET_ASSETS = import.meta.env.VITE_SUPABASE_BUCKET_ASSETS ?? "mailer_assets";
export const DEFAULT_ACTOR_ID = import.meta.env.VITE_DEFAULT_ACTOR_ID ?? "00000000-0000-0000-0000-000000000001";

// Usuario de la sesión actual: AuthGate lo mantiene al día y db.ts lo escribe en
// created_by. Sin sesión cae al actor por defecto (app sin Supabase configurado).
let actorId: string | null = null;

export function setActorId(id: string | null): void {
  actorId = id;
}

export function getActorId(): string {
  return actorId ?? DEFAULT_ACTOR_ID;
}

/** Token de la sesión para llamar Edge Functions; sin sesión, la anon key. */
export async function getAccessToken(): Promise<string> {
  if (!supabase) return SUPABASE_ANON_KEY;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? SUPABASE_ANON_KEY;
}
