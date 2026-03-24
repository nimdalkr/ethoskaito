import { describe, expect, it } from "vitest";

import { parseKaitoProjectSeed } from "@/lib/data/kaito-projects";

describe("kaito project seed parser", () => {
  it("deduplicates repeated projects and keeps selected-project aliases", () => {
    const entries = parseKaitoProjectSeed();
    const lumiterra = entries.find((entry) => entry.aliases.includes("LUMITERRA"));
    const metamask = entries.find((entry) => entry.name === "MetaMask");
    const billions = entries.find((entry) => entry.name === "Billions");

    expect(entries.filter((entry) => entry.aliases.includes("LUMITERRA"))).toHaveLength(1);
    expect(lumiterra?.aliases).toContain("LUMITERRA");
    expect(metamask?.aliases).toContain("MASK");
    expect(billions?.aliases).toContain("Billions Network");
  });

  it("parses menu and selected-project sections together", () => {
    const entries = parseKaitoProjectSeed();

    expect(entries.some((entry) => entry.name === "Monad")).toBe(true);
    expect(entries.some((entry) => entry.name === "Polymarket")).toBe(true);
    expect(entries.some((entry) => entry.name === "Ethos Network")).toBe(true);
  });

  it("adds manual seeds for active projects missing from the selected list", () => {
    const entries = parseKaitoProjectSeed();
    const perle = entries.find((entry) => entry.name === "Perle Labs");
    const xoob = entries.find((entry) => entry.name === "XOOB");

    expect(perle?.aliases).toContain("PerleLabs");
    expect(perle?.aliases).toContain("PerleAI");
    expect(xoob?.aliases).toContain("XOOBNetwork");
  });
});
