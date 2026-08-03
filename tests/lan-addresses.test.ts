import { describe, expect, it } from "vitest";

import { isPrivateIPv4, selectPreferredLanAddress, sortLanAddresses } from "@/lib/session/lan-addresses";

describe("offline church LAN address selection", () => {
  it("recognises RFC1918 router addresses", () => {
    expect(isPrivateIPv4("192.168.2.56")).toBe(true);
    expect(isPrivateIPv4("10.0.0.4")).toBe(true);
    expect(isPrivateIPv4("172.20.10.2")).toBe(true);
    expect(isPrivateIPv4("169.254.2.1")).toBe(false);
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
  });

  it("prefers a physical private interface over VPN and virtual adapters", () => {
    const sorted = sortLanAddresses([
      { interface: "utun4", address: "10.9.0.2" },
      { interface: "bridge100", address: "192.168.64.1" },
      { interface: "en0", address: "192.168.2.56" },
    ]);
    expect(sorted[0]).toEqual({ interface: "en0", address: "192.168.2.56" });
  });

  it("accepts an explicit address override only when it belongs to this Mac", () => {
    const entries = [
      { interface: "en0", address: "192.168.2.56" },
      { interface: "en7", address: "10.0.0.20" },
    ];
    expect(selectPreferredLanAddress(entries, "10.0.0.20")).toBe("10.0.0.20");
    expect(selectPreferredLanAddress(entries, "10.0.0.99")).toBe("192.168.2.56");
  });
});
