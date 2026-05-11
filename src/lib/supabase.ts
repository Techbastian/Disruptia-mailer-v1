import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabaseUrl = rawSupabaseUrl.startsWith("http") ? rawSupabaseUrl : rawSupabaseUrl ? `https://${rawSupabaseUrl}` : "";

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const SUPABASE_BUCKET_ASSETS = import.meta.env.VITE_SUPABASE_BUCKET_ASSETS ?? "mailer_assets";
export const DEFAULT_ACTOR_ID = import.meta.env.VITE_DEFAULT_ACTOR_ID ?? "00000000-0000-0000-0000-000000000001";
