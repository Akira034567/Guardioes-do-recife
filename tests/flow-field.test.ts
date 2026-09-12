import { describe, expect, it } from "vitest";
import { flowFieldFor, flowSpeedMultiplier, MIN_FLOW_MULTIPLIER, type FlowField } from "../src/game/core/FlowField";
import { GUARDIANS } from "../src/game/data/guardians";

const counter: FlowField = { ownerId: "T1", x: 0, y: 0, radius: 100, speedFactor: 0.75, mode: "counter" };

describe("flow fields", () => {
  it("slows only inside the radius and takes the strongest zone", () => {
    expect(flowSpeedMultiplier([counter], { x: 50, y: 0 })).toBeCloseTo(0.75);
    expect(flowSpeedMultiplier([counter], { x: 150, y: 0 })).toBe(1);
    const stronger: FlowField = { ...counter, ownerId: "T2", speedFactor: 0.6 };
    expect(flowSpeedMultiplier([counter, stronger], { x: 10, y: 10 })).toBeCloseTo(0.6);
  });

  it("respects slow resistance for counter currents and clamps the floor", () => {
    expect(flowSpeedMultiplier([counter], { x: 0, y: 0 }, 0.5)).toBeCloseTo(0.875);
    const extreme: FlowField = { ...counter, speedFactor: 0.1 };
    expect(flowSpeedMultiplier([extreme], { x: 0, y: 0 })).toBe(MIN_FLOW_MULTIPLIER);
  });

  it("supports boost zones and derives the field from the guardian's range", () => {
    const boost: FlowField = { ...counter, ownerId: "B", speedFactor: 1.2, mode: "boost" };
    expect(flowSpeedMultiplier([boost], { x: 0, y: 0 }, 0.9)).toBeCloseTo(1.2);
    const effect = GUARDIANS["sea-turtle"].branches[1].upgrades[0].flowField!;
    const field = flowFieldFor({ id: "T", x: 10, y: 20 }, effect, 90);
    expect(field).toMatchObject({ ownerId: "T", x: 10, y: 20, radius: 90 * effect.radiusMultiplier, speedFactor: 0.75, mode: "counter" });
  });
});
