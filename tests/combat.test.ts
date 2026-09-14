import { describe, expect, it } from "vitest";
import {
  hasReachedBlockerContact,
  isInRange,
  armorReduction,
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

  it("includes the range boundary and reduces damage by a fraction, never by subtraction", () => {
    expect(isInRange({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
    // V2: a armadura absorve `armadura/(armadura+16)`. Sem piso de 1, sem subtração.
    expect(armorReduction(0)).toBe(0);
    expect(armorReduction(4)).toBeCloseTo(0.2);
    expect(armorReduction(9)).toBeCloseTo(0.36);
    expect(armorReduction(16)).toBeCloseTo(0.5);
    expect(mitigatedDamage(12, 0)).toBe(12);
    expect(mitigatedDamage(12, 4)).toBeCloseTo(9.6);
    // O golpe fraco perde a MESMA fração que o golpe forte: é isso que salva o dano distribuído.
    expect(mitigatedDamage(3, 9) / 3).toBeCloseTo(mitigatedDamage(60, 9) / 60);
    // Armadura nunca zera dano, por maior que seja.
    expect(mitigatedDamage(10, 1000)).toBeGreaterThan(0);
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
