import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Returns the persisted session and also consumes the legacy query-style
 * Supabase redirect once. Older links put the access and refresh tokens in the
 * query string; Supabase normally detects only hash/PKCE callbacks. The tokens
 * are removed from the address bar immediately after they have been stored.
 */
export async function ensureSupabaseSession(supabase = getSupabaseClient()): Promise<Session | null> {
  if (!supabase) return null;
  const current = await supabase.auth.getSession();
  if (current.data.session) return current.data.session;
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const accessToken = url.searchParams.get("access_token");
  const refreshToken = url.searchParams.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.session) return null;

  url.searchParams.delete("access_token");
  url.searchParams.delete("refresh_token");
  url.searchParams.delete("expires_at");
  url.searchParams.delete("expires_in");
  url.searchParams.delete("token_type");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  return data.session;
}
