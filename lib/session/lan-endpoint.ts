export type LanEndpoint = {
  host: string;
  port: number;
  authority: string;
  httpOrigin: string;
  websocketUrl: string;
};

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

/** Accepts only explicit local destinations; public hosts are never probed. */
export function parseLanEndpoint(input: string | null | undefined): LanEndpoint | null {
  const raw = input?.trim();
  if (!raw) return null;
  if (/[/\\?#@]/.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(`http://${raw}`);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (!(hostname === "localhost" || hostname.endsWith(".local") || isPrivateIpv4(hostname))) return null;
  const port = url.port ? Number(url.port) : 3000;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const authority = `${hostname}:${port}`;
  return {
    host: hostname,
    port,
    authority,
    httpOrigin: `http://${authority}`,
    websocketUrl: `ws://${authority}/session`,
  };
}

export function cloudJoinUrl(publicOrigin: string, endpoint: LanEndpoint, token: string): string {
  const url = new URL("/join", publicOrigin);
  url.searchParams.set("host", endpoint.authority);
  url.searchParams.set("t", token);
  return url.toString();
}

export function localJoinUrl(endpoint: LanEndpoint, token: string): string {
  const url = new URL("/join", endpoint.httpOrigin);
  url.searchParams.set("t", token);
  return url.toString();
}
