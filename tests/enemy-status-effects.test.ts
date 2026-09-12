import { describe, expect, it } from "vitest";
import { EnemyStatus } from "../src/game/core/EnemyStatus";
import type { PoisonEffect } from "../src/game/types";

const poison: PoisonEffect = { damagePerTick: 4, tickMs: 1000, durationMs: 5000, maxStacks: 2 };

describe("enemy status: poison, marks and sonar flags", () => {
  it("ticks poison once per interval, stacks up to the cap and expires", () => {
    const status = new EnemyStatus();
    status.applyPoison(poison, 0);
    expect(status.drainPoison(999)).toBe(0);
    expect(status.drainPoison(1000)).toBe(4);
    status.applyPoison(poison, 1500);
    status.applyPoison(poison, 1600);
    status.applyPoison(poison, 1700);
    expect(status.poisonStacks(1700)).toBe(2);
    expect(status.drainPoison(3000)).toBe(16);
    expect(status.isPoisoned(6000)).toBe(true);
    expect(status.drainPoison(6600)).toBe(24);
    expect(status.isPoisoned(6700)).toBe(true);
    expect(status.drainPoison(7000)).toBe(0);
    expect(status.isPoisoned(7001)).toBe(false);
  });

  it("keeps the mark bonus private to the marking source", () => {
    const status = new EnemyStatus();
    status.applyMark("shark-1", 1.3, 6000, 0);
    expect(status.markMultiplier("shark-1", 10)).toBeCloseTo(1.3);
    expect(status.markMultiplier("shark-2", 10)).toBe(1);
    expect(status.markMultiplier(undefined, 10)).toBe(1);
    expect(status.markedBy(10)).toBe("shark-1");
    status.boostMark("shark-2", 2, 10);
    expect(status.markMultiplier("shark-1", 10)).toBeCloseTo(1.3);
    status.boostMark("shark-1", 1.6, 10);
    expect(status.markMultiplier("shark-1", 10)).toBeCloseTo(1.6);
    expect(status.isMarked(6000)).toBe(false);
    status.update(6000);
    expect(status.markedBy(6000)).toBeNull();
  });

  it("tracks reveal and priority independently of movement", () => {
    const status = new EnemyStatus();
    status.reveal(4000, 0);
    status.flagPriority(5000, 0);
    expect(status.isRevealed(3999)).toBe(true);
    expect(status.isRevealed(4000)).toBe(false);
    expect(status.isPriority(4999)).toBe(true);
    expect(status.speedMultiplier(10)).toBe(1);
  });

  it("lets a stun without immunity be reapplied, unlike the jellyfish paralysis", () => {
    const status = new EnemyStatus();
    expect(status.tryStun(500, 0, 0)).toBe(true);
    expect(status.tryStun(500, 0, 100)).toBe(false);
    expect(status.tryStun(500, 0, 500)).toBe(true);
    const jelly = new EnemyStatus();
    expect(jelly.tryStun(600, 3500, 0)).toBe(true);
    expect(jelly.tryStun(600, 3500, 700)).toBe(false);
    expect(jelly.isStunImmune(700)).toBe(true);
  });
});
