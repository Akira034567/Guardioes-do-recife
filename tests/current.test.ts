import { describe, expect, it } from "vitest";
import { containsPoint, enemySpeedMultiplier, projectileDrift } from "../src/game/core/CurrentField";
import type { CurrentZoneDefinition } from "../src/game/types";

const zone: CurrentZoneDefinition = {
  id: "test",
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  direction: { x: 1, y: 0 },
  speedModifier: 0.25,
  projectileDrift: 40,
};

describe("current field", () => {
  it("detects points inside its bounds", () => {
    expect(containsPoint(zone, { x: 10, y: 20 })).toBe(true);
    expect(containsPoint(zone, { x: 111, y: 20 })).toBe(false);
  });

  it("accelerates with the flow and slows against it", () => {
    expect(enemySpeedMultiplier(zone, { x: 1, y: 0 })).toBe(1.25);
    expect(enemySpeedMultiplier(zone, { x: -1, y: 0 })).toBe(0.75);
    expect(enemySpeedMultiplier(zone, { x: 1, y: 0 }, true)).toBe(0.75);
  });

  it("reverses projectile drift", () => {
    expect(projectileDrift(zone, 0.5)).toEqual({ x: 20, y: 0 });
    expect(projectileDrift(zone, 0.5, true)).toEqual({ x: -20, y: 0 });
  });
});
