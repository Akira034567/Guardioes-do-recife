import { describe, expect, it } from "vitest";
import { applyStatusTo } from "../src/game/core/CrowdControl";
import { EnemyStatus } from "../src/game/core/EnemyStatus";
import { resolveGuardianStats } from "../src/game/core/GuardianStats";
import { StatusContainer } from "../src/game/core/StatusEffects";
import { GUARDIANS } from "../src/game/data/guardians";
import { FakeEnemy } from "./helpers/fakes";

describe("StatusContainer registry rules", () => {
  it("keeps the strongest slow and the longest duration (REFRESH + min)", () => {
    const status = new StatusContainer("enemy");
    expect(status.apply({ type: "slow", strength: 0.8, durationMs: 1000 }, 0)).toBe("applied");
    expect(status.apply({ type: "slow", strength: 0.5, durationMs: 500 }, 100)).toBe("refreshed");
    expect(status.strength("slow", 200)).toBe(0.5);
    expect(status.until("slow", 200)).toBe(1000);
    expect(status.apply({ type: "slow", strength: 0.9, durationMs: 3000 }, 300)).toBe("refreshed");
    expect(status.strength("slow", 400)).toBe(0.5);
    expect(status.until("slow", 400)).toBe(3300);
    expect(status.has("slow", 3300)).toBe(false);
  });

  it("ignores a stun while one is active and honours the immunity window after it", () => {
    const status = new StatusContainer("enemy");
    expect(status.apply({ type: "stun", strength: 1, durationMs: 600, immunityMs: 1000 }, 0)).toBe("applied");
    expect(status.apply({ type: "stun", strength: 1, durationMs: 600 }, 100)).toBe("ignored");
    expect(status.has("stun", 599)).toBe(true);
    expect(status.has("stun", 600)).toBe(false);
    expect(status.isImmune("stun", 600)).toBe(true);
    expect(status.apply({ type: "stun", strength: 1, durationMs: 600 }, 900)).toBe("immune");
    expect(status.apply({ type: "stun", strength: 1, durationMs: 600 }, 1600)).toBe("applied");
  });

  it("stacks poison up to the cap with the fastest tick and drains ticks in order", () => {
    const status = new StatusContainer("enemy");
    status.apply({ type: "poison", strength: 4, durationMs: 3000, tickMs: 1000, maxStacks: 2, stackBehavior: "STACK" }, 0);
    expect(status.apply({ type: "poison", strength: 6, durationMs: 3000, tickMs: 500, maxStacks: 2, stackBehavior: "STACK" }, 100)).toBe("stacked");
    expect(status.apply({ type: "poison", strength: 2, durationMs: 3000, tickMs: 1000, maxStacks: 2, stackBehavior: "STACK" }, 200)).toBe("stacked");
    expect(status.stacks("poison", 200)).toBe(2);
    expect(status.strength("poison", 200)).toBe(6);
    expect(status.drainTicks("poison", 1000)).toBe(12);
    expect(status.list(1000).map((effect) => effect.type)).toEqual(["poison"]);
  });

  it("keeps one mark at a time, private to its source, and drops it when the source is removed", () => {
    const status = new StatusContainer("enemy");
    status.apply({ type: "mark", strength: 1.3, durationMs: 5000, sourceId: "G1" }, 0);
    expect(status.apply({ type: "mark", strength: 1.5, durationMs: 5000, sourceId: "G2" }, 10)).toBe("replaced");
    expect(status.strength("mark", 20, "G1")).toBeNull();
    expect(status.strength("mark", 20, "G2")).toBe(1.5);
    expect(status.boost("mark", "G1", 2, 20)).toBe(false);
    expect(status.boost("mark", "G2", 2, 20)).toBe(true);
    status.apply({ type: "slow", strength: 0.5, durationMs: 5000, sourceId: "G2" }, 20);
    expect(status.removeBySource("G2")).toEqual(["mark"]);
    expect(status.has("mark", 30)).toBe(false);
    expect(status.has("slow", 30)).toBe(true);
  });

  it("refuses zero durations, immunities and effects that do not apply to the owner", () => {
    const enemy = new StatusContainer("enemy", new Set(["stun"]));
    expect(enemy.apply({ type: "stun", strength: 1, durationMs: 500 }, 0)).toBe("immune");
    expect(enemy.apply({ type: "slow", strength: 0.5, durationMs: 0 }, 0)).toBe("ignored");
    expect(enemy.apply({ type: "attackSpeedBuff", strength: 1.2, durationMs: 500 }, 0)).toBe("immune");
    const guardian = new StatusContainer("guardian");
    expect(guardian.apply({ type: "attackSpeedBuff", strength: 1.2, durationMs: 500 }, 0)).toBe("applied");
    expect(guardian.apply({ type: "mark", strength: 1.2, durationMs: 500 }, 0)).toBe("immune");
  });

  it("clears everything on death and forgets expired effects on update", () => {
    const status = new StatusContainer("enemy");
    status.apply({ type: "vulnerability", strength: 1.2, durationMs: 100 }, 0);
    status.apply({ type: "reveal", strength: 1, durationMs: 100 }, 0);
    status.update(150);
    expect(status.list(150)).toEqual([]);
    status.apply({ type: "vulnerability", strength: 1.2, durationMs: 100 }, 200);
    status.clear();
    expect(status.has("vulnerability", 200)).toBe(false);
  });
});

describe("EnemyStatus facade and generic control", () => {
  it("scales a generic status by the enemy resistance for that type", () => {
    const status = new EnemyStatus(0, { slow: 0.5 });
    status.applySlow(0.5, 1000, 0);
    expect(status.slowFactor(10)).toBeCloseTo(0.75);
    expect(status.resistance("stun")).toBe(0);
  });

  it("applies elite diminishing returns to control statuses through applyStatusTo", () => {
    const elite = new FakeEnemy("E1", "moray");
    expect(applyStatusTo(elite, { type: "root", strength: 1, durationMs: 1000 }, 0)).toBe("applied");
    expect(elite.status.isRooted(500)).toBe(true);
    expect(elite.status.speedMultiplier(500)).toBe(0);
    // Segundo controle na janela: 75% da duração; terceiro: 50%; depois imune.
    expect(applyStatusTo(elite, { type: "root", strength: 1, durationMs: 1000 }, 1000)).toBe("applied");
    expect(elite.status.container.until("root", 1000)).toBe(1750);
    expect(applyStatusTo(elite, { type: "root", strength: 1, durationMs: 1000 }, 2000)).toBe("applied");
    expect(applyStatusTo(elite, { type: "root", strength: 1, durationMs: 1000 }, 3000)).toBe("ignored");
    expect(elite.status.isControlImmune(3000)).toBe(true);
  });

  it("refuses statuses on dead enemies and non-control statuses skip the control history", () => {
    const enemy = new FakeEnemy("E1", "swimmer");
    enemy.dead = true;
    expect(applyStatusTo(enemy, { type: "slow", strength: 0.5, durationMs: 1000 }, 0)).toBe("ignored");
    const alive = new FakeEnemy("E2", "moray");
    for (let index = 0; index < 5; index += 1) applyStatusTo(alive, { type: "vulnerability", strength: 1.2, durationMs: 1000 }, index);
    expect(alive.status.isControlImmune(10)).toBe(false);
    expect(alive.status.damageMultiplier(10)).toBe(1.2);
  });
});

describe("guardian status modifiers", () => {
  it("speeds up or slows down a guardian through its own status container", () => {
    const definition = GUARDIANS["pistol-shrimp"];
    const base = resolveGuardianStats(definition, { branchId: null, upgradeLevel: 0 });
    const buffed = resolveGuardianStats(definition, { branchId: null, upgradeLevel: 0 }, undefined, { attackSpeedMultiplier: 1.25, damageMultiplier: 1.1 });
    expect(buffed.cooldownMs).toBeCloseTo(base.cooldownMs / 1.25);
    expect(buffed.damage).toBeCloseTo(base.damage * 1.1);
    const disrupted = resolveGuardianStats(definition, { branchId: null, upgradeLevel: 0 }, undefined, { attackSpeedMultiplier: 0.5 });
    expect(disrupted.cooldownMs).toBeCloseTo(base.cooldownMs * 2);
  });
});
