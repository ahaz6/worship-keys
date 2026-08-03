const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://mmoizwtjnpfmowoqpmfa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_oiTCgL6_m7RvLKVrwOdp7A_Ojp1zjSa";

/** Validates a browser Supabase bearer token without exposing any server secret. */
export async function authenticatedUserId(authorization: string): Promise<string | null> {
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: SUPABASE_PUBLISHABLE_KEY },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string };
  return user.id ?? null;
}

/** The same allowlist protects both replacing and reading the church Drive file. */
export function canAccessDriveSetlist(userId: string): boolean {
  return (process.env.GOOGLE_DRIVE_DEPLOY_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(userId);
}

