import { describe, expect, it } from "vitest";
import { EnemyStatus } from "../src/game/core/EnemyStatus";

describe("EnemyStatus", () => {
  it("keeps the strongest slow, expires it and honours resistance", () => {
    const status = new EnemyStatus();
    status.applySlow(0.68, 1000, 0);
    status.applySlow(0.8, 3000, 0);
    expect(status.slowFactor(500)).toBe(0.68);
    expect(status.slowFactor(1500)).toBe(0.68);
    expect(status.slowFactor(3001)).toBe(1);

    const resistant = new EnemyStatus(0.5);
    resistant.applySlow(0.5, 1000, 0);
    expect(resistant.slowFactor(10)).toBeCloseTo(0.75);
  });

  it("stuns once and then grants immunity before allowing another stun", () => {
    const status = new EnemyStatus();
    expect(status.tryStun(600, 3500, 0)).toBe(true);
    expect(status.isStunned(300)).toBe(true);
    expect(status.speedMultiplier(300)).toBe(0);
    expect(status.tryStun(600, 3500, 300)).toBe(false);
    expect(status.isStunned(700)).toBe(false);
    expect(status.isStunImmune(700)).toBe(true);
    expect(status.tryStun(600, 3500, 4000)).toBe(false);
    expect(status.tryStun(600, 3500, 4101)).toBe(true);
  });

  it("holds bosses briefly with a long immunity afterwards", () => {
    const status = new EnemyStatus();
    expect(status.tryHold(1200, 9000, 0)).toBe(true);
    expect(status.isHeld(1000)).toBe(true);
    expect(status.speedMultiplier(1000)).toBe(0);
    expect(status.tryHold(1200, 9000, 2000)).toBe(false);
    expect(status.speedMultiplier(2000)).toBe(1);
    expect(status.tryHold(1200, 9000, 10_201)).toBe(true);
  });

  it("does not stack vulnerability: the strongest multiplier wins", () => {
    const status = new EnemyStatus();
    status.applyVulnerability(1.1, 2500, 0);
    status.applyVulnerability(1.2, 1000, 0);
    status.applyVulnerability(1.15, 500, 0);
    expect(status.damageMultiplier(100)).toBe(1.2);
    expect(status.damageMultiplier(2600)).toBe(1);
    status.applyVulnerability(0.5, 1000, 3000);
    expect(status.damageMultiplier(3100)).toBe(1);
  });

  it("clears expired effects on update", () => {
    const status = new EnemyStatus();
    status.applySlow(0.5, 100, 0);
    status.applyVulnerability(1.2, 100, 0);
    status.update(200);
    expect(status.speedMultiplier(200)).toBe(1);
    expect(status.damageMultiplier(200)).toBe(1);
  });
});
