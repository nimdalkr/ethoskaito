import { describe, expect, it } from "vitest";
import { matchProjectsByText } from "@/lib/analytics/project-match";

describe("project text matching", () => {
  const projects = [
    { projectId: "p1", aliases: ["alphacore", "alpha core"], allowLooseTextMatch: true },
    { projectId: "p2", aliases: ["orbit labs", "orbit"], allowLooseTextMatch: true }
  ];

  it("matches normalized aliases inside tweet text", () => {
    const result = matchProjectsByText("Watching Alpha Core and Orbit Labs today.", projects);
    expect(result).toEqual(["p1", "p2"]);
  });

  it("ignores aliases shorter than three normalized characters", () => {
    const result = matchProjectsByText("A random post mentioning or", [
      { projectId: "p3", aliases: ["or"] }
    ]);
    expect(result).toEqual([]);
  });

  it("does not duplicate project IDs when multiple aliases match", () => {
    const result = matchProjectsByText("alphacore alpha core", projects);
    expect(result).toEqual(["p1"]);
  });

  it("blocks ambiguous single-word aliases on loose text alone", () => {
    const result = matchProjectsByText("building more momentum in this space with a continuous loop", [
      { projectId: "p3", aliases: ["Momentum"], allowLooseTextMatch: false },
      { projectId: "p4", aliases: ["Space"], allowLooseTextMatch: false },
      { projectId: "p5", aliases: ["Loop"], allowLooseTextMatch: false }
    ]);

    expect(result).toEqual([]);
  });

  it("still matches strong handle and cashtag signals", () => {
    const result = matchProjectsByText("Following @PerleLabs and rotating into $XOOB today", [
      { projectId: "p6", aliases: ["PerleLabs"], allowLooseTextMatch: false },
      { projectId: "p7", aliases: ["XOOB"], allowLooseTextMatch: false }
    ]);

    expect(result).toEqual(["p6", "p7"]);
  });
});
