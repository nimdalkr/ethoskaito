import { describe, expect, it } from "vitest";
import { matchProjectsByText } from "@/lib/analytics/project-match";

describe("project text matching", () => {
  const projects = [
    { projectId: "p1", aliases: ["alphacore", "alpha core"] },
    { projectId: "p2", aliases: ["orbit labs", "orbit"] }
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
});
