import { describe, expect, it } from "vitest";

import { isOfficialProjectUsername, normalizeXUsername } from "@/lib/collector/project-accounts";

describe("project account filtering", () => {
  it("normalizes x usernames consistently", () => {
    expect(normalizeXUsername("@Monad")).toBe("monad");
  });

  it("detects official project usernames after normalization", () => {
    expect(isOfficialProjectUsername("@Monad", new Set(["monad"]))).toBe(true);
    expect(isOfficialProjectUsername("builder_alpha", new Set(["monad"]))).toBe(false);
  });
});
