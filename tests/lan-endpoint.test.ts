import { describe, expect, it } from "vitest";

import { cloudJoinUrl, localJoinUrl, parseLanEndpoint } from "@/lib/session/lan-endpoint";

describe("LAN session endpoints", () => {
  it.each(["192.168.2.56:3000", "10.0.0.8", "172.20.10.2:4100", "worship-keys.local:3000", "localhost:3000"])(
    "accepts local host %s",
    (host) => expect(parseLanEndpoint(host)).not.toBeNull(),
  );

  it.each(["8.8.8.8:3000", "example.com:3000", "192.168.2.56/path", "user@192.168.2.56", "192.168.2.56:99999"])(
    "rejects unsafe host %s",
    (host) => expect(parseLanEndpoint(host)).toBeNull(),
  );

  it("builds cloud and local join links without changing the token", () => {
    const endpoint = parseLanEndpoint("192.168.2.56:3000");
    expect(endpoint).not.toBeNull();
    if (!endpoint) return;
    expect(cloudJoinUrl("https://worship-keys-psi.vercel.app", endpoint, "viewer_token-123"))
      .toBe("https://worship-keys-psi.vercel.app/join?host=192.168.2.56%3A3000&t=viewer_token-123");
    expect(localJoinUrl(endpoint, "viewer_token-123"))
      .toBe("http://192.168.2.56:3000/join?t=viewer_token-123");
  });
});
