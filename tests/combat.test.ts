import { describe, expect, it } from "vitest";
import {
  hasReachedBlockerContact,
  isInRange,
  mitigatedDamage,
  predictInterceptPoint,
  projectileTurnRate,
  selectLeadingTarget,
} from "../src/game/core/Combat";

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

  it("leads a moving target for predictive projectiles", () => {
    const intercept = predictInterceptPoint(
      { x: 0, y: 0 },
      { x: 100, y: 0, velocity: { x: 0, y: 50 } },
      200,
    );
    expect(intercept.x).toBe(100);
    expect(intercept.y).toBeGreaterThan(20);
    expect(intercept.y).toBeLessThan(30);
  });

  it("reduces homing after piercing unless supersônico is active", () => {
    expect(projectileTurnRate(false, 0)).toBe(7);
    expect(projectileTurnRate(false, 1)).toBeLessThan(2);
    expect(projectileTurnRate(true, 1)).toBe(12);
  });

  it("captures blockers only after physical contact", () => {
    expect(hasReachedBlockerContact(950, 1000, 42)).toBe(false);
    expect(hasReachedBlockerContact(958, 1000, 42)).toBe(true);
    expect(hasReachedBlockerContact(1008, 1000, 42)).toBe(true);
    expect(hasReachedBlockerContact(1013, 1000, 42)).toBe(false);
  });

  it("keeps blocked enemies eligible as targets", () => {
    const blocked = {
      id: "blocked",
      x: 20,
      y: 0,
      progress: 0.8,
      dead: false,
      reachedGoal: false,
      blockedById: "G1",
    };
    expect(selectLeadingTarget([blocked], { x: 0, y: 0 }, 50)).toBe(blocked);
  });
});
