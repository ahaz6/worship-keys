import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  // These fallbacks are intentionally public browser credentials. Supabase
  // publishable keys identify the project; RLS and the user's JWT protect data.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://mmoizwtjnpfmowoqpmfa.supabase.co";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_oiTCgL6_m7RvLKVrwOdp7A_Ojp1zjSa";
  if (!url || !publishableKey) return null;
  client ??= createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
