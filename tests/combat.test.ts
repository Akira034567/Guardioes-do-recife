import { describe, expect, it } from "vitest";
import { isInRange, mitigatedDamage, selectLeadingTarget } from "../src/game/core/Combat";

describe("combat rules", () => {
  it("selects the living in-range enemy furthest along the route", () => {
    const enemies = [
      { id: "near", x: 20, y: 0, progress: 0.2, dead: false, reachedGoal: false },
      { id: "lead", x: 50, y: 0, progress: 0.7, dead: false, reachedGoal: false },
      { id: "dead", x: 10, y: 0, progress: 0.9, dead: true, reachedGoal: false },
      { id: "far", x: 200, y: 0, progress: 0.95, dead: false, reachedGoal: false },
    ];
    expect(selectLeadingTarget(enemies, { x: 0, y: 0 }, 100)?.id).toBe("lead");
  });

  it("includes the range boundary and guarantees chip damage", () => {
    expect(isInRange({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
    expect(mitigatedDamage(3, 8)).toBe(1);
    expect(mitigatedDamage(12, 4)).toBe(8);
  });
});
