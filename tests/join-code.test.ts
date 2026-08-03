import { describe, expect, it } from "vitest";

import { isJoinCode, normaliseJoinCode } from "@/lib/session/join-code";

describe("six-digit session codes", () => {
  it("keeps only the first six digits for phone input", () => {
    expect(normaliseJoinCode("12 34-56abc78")).toBe("123456");
  });

  it("accepts exactly six digits", () => {
    expect(isJoinCode("123456")).toBe(true);
    expect(isJoinCode("12345")).toBe(false);
    expect(isJoinCode("12345a")).toBe(false);
  });
});
