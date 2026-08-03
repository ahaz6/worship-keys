/**
 * Worship Keys host server.
 *
 * Next.js alone cannot own the HTTP upgrade handshake, and the live session
 * needs one. This process therefore owns the socket: it serves the app through
 * Next, answers the small set of session endpoints itself, and hands WebSocket
 * upgrades to the session server. Session state lives in this one process, so
 * the HTTP endpoints and the socket share a single SessionStore.
 *
 * It binds 0.0.0.0 on purpose (spec 18.4) so musician iPads can reach the host
 * over the LAN. The host bootstrap secret is only ever served to loopback.
 */

import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import next from "next";
import QRCode from "qrcode";

import { isLoopbackAddress } from "./lib/session/authorization.ts";
import { selectPreferredLanAddress, sortLanAddresses } from "./lib/session/lan-addresses.ts";
import { SessionStore } from "./lib/session/session-store.ts";
import { createSessionServer } from "./lib/session/websocket-server.ts";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const store = new SessionStore({ sessionName: process.env.WK_SESSION_NAME ?? "Sunday Morning" });
const publicAppOrigin = (process.env.WORSHIP_KEYS_PUBLIC_APP_URL ?? "https://worship-keys-psi.vercel.app").replace(/\/$/, "");
const allowedPublicOrigins = new Set([
  publicAppOrigin,
  "https://worship-keys-psi.vercel.app",
]);

/** Every non-internal IPv4 address, so the host screen can show the real one. */
function lanAddresses() {
  const found = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) found.push({ interface: name, address: entry.address });
    }
  }
  return sortLanAddresses(found);
}

function json(response, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  response.end(payload);
}

function publicLanCors(request) {
  const origin = request.headers.origin;
  if (!origin || !allowedPublicOrigins.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-allow-private-network": "true",
    vary: "Origin",
  };
}

async function readJsonBody(request, limitBytes = 4096) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limitBytes) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/**
 * Handles the session endpoints. Returns true when the request was answered
 * here, false to let Next render the page.
 */
async function handleSessionRoute(request, response, url) {
  if (!url.pathname.startsWith("/api/session/")) return false;

  if (url.pathname === "/api/session/leader" && request.method === "OPTIONS") {
    response.writeHead(204, publicLanCors(request));
    response.end();
    return true;
  }

  // GET /api/session/bootstrap — host credentials, loopback callers only.
  if (url.pathname === "/api/session/bootstrap" && request.method === "GET") {
    if (!isLoopbackAddress(request.socket.remoteAddress)) {
      json(response, 403, { error: "Host controls are only available on the machine running Worship Keys." });
      return true;
    }
    const addresses = lanAddresses();
    const preferred = selectPreferredLanAddress(addresses, process.env.WK_LAN_IP) ?? "localhost";
    const authority = `${preferred}:${port}`;
    const localJoinUrl = `http://${authority}/join?t=${store.viewerToken}`;
    const cloudJoinUrl = `${publicAppOrigin}/join?host=${encodeURIComponent(authority)}&t=${store.viewerToken}`;
    json(response, 200, {
      sessionId: store.sessionId,
      hostToken: store.hostToken,
      viewerToken: store.viewerToken,
      leaderPin: store.pin,
      joinUrl: localJoinUrl,
      localJoinUrl,
      cloudJoinUrl,
      addresses,
      port,
    });
    return true;
  }

  // POST /api/session/pin — rotate the leader PIN. Loopback only.
  if (url.pathname === "/api/session/pin" && request.method === "POST") {
    if (!isLoopbackAddress(request.socket.remoteAddress)) {
      json(response, 403, { error: "Only the host can rotate the leader PIN." });
      return true;
    }
    const leaderPin = store.rotatePin();
    sessionServer.syncRoles("The host created a new leader PIN. Leader access was removed.");
    json(response, 200, { leaderPin });
    return true;
  }

  // GET /api/session/qr?url=... — QR image for the join link.
  if (url.pathname === "/api/session/qr" && request.method === "GET") {
    const target = url.searchParams.get("url") ?? "";
    // Only ever encode this session's own join link, never arbitrary input.
    if (!target.includes(store.viewerToken)) {
      json(response, 400, { error: "Unknown join link." });
      return true;
    }
    const dataUrl = await QRCode.toDataURL(target, { margin: 1, width: 416, color: { dark: "#0d0d12", light: "#f4f3fa" } });
    json(response, 200, { dataUrl });
    return true;
  }

  // POST /api/session/leader — a device offering the leader PIN.
  if (url.pathname === "/api/session/leader" && request.method === "POST") {
    const cors = publicLanCors(request);
    let body;
    try {
      body = await readJsonBody(request);
    } catch {
      json(response, 400, { error: "Unreadable request." }, cors);
      return true;
    }
    const token = typeof body.token === "string" ? body.token : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    const joined = store.join(token, "Leader device");
    if ("error" in joined) {
      json(response, 401, { error: joined.error }, cors);
      return true;
    }
    const outcome = store.requestLeaderRole(joined.deviceId, pin);
    json(response, outcome.status === "rejected" ? 403 : 200, outcome, cors);
    return true;
  }

  json(response, 404, { error: "Unknown session endpoint." });
  return true;
}

await app.prepare();
const handleNextUpgrade = app.getUpgradeHandler();

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  handleSessionRoute(request, response, url)
    .then((handled) => {
      // Next parses the URL itself; handing it a WHATWG URL breaks its
      // normalisation and produces a redirect loop.
      if (!handled) handle(request, response);
    })
    .catch((error) => {
      console.error("Session route failed:", error);
      if (!response.headersSent) json(response, 500, { error: "Session request failed." });
    });
});

const sessionServer = createSessionServer(server, store);

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname === "/session") {
    sessionServer.handleUpgrade(request, socket, head);
    return;
  }
  // Everything else (Next's HMR socket in development) stays with Next.
  if (dev) {
    void handleNextUpgrade(request, socket, head);
    return;
  }
  socket.destroy();
});

server.listen(port, hostname, () => {
  const addresses = lanAddresses();
  console.log(`\n  Worship Keys — host ready`);
  console.log(`  Local     http://localhost:${port}`);
  for (const entry of addresses) {
    console.log(`  Network   http://${entry.address}:${port}  (${entry.interface})`);
  }
  console.log(`  Leader PIN ${store.pin}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    sessionServer.close();
    server.close(() => process.exit(0));
  });
}
