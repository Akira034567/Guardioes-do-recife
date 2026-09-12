import { describe, expect, it } from "vitest";
import {
  registerSharkHit,
  targetPolicyFor,
  updateFrenzy,
  updateMark,
  updatePushWave,
  updateTrap,
  type BehaviorEvent,
  type BehaviorHooks,
} from "../src/game/core/GuardianBehaviors";
import { GUARDIANS } from "../src/game/data/guardians";
import { FakeEnemy, FakeGuardian } from "./helpers/fakes";

function hooks(now: number, events: BehaviorEvent[] = [], damaged: Array<{ id: string; amount: number }> = []): BehaviorHooks<FakeEnemy> {
  return {
    now,
    damage: (enemy, amount) => damaged.push({ id: enemy.id, amount }),
    emit: (event) => events.push(event),
  };
}

describe("shark behaviours", () => {
  it("speeds up against wounded targets and stacks per wounded enemy in Frenesi II", () => {
    const shark = new FakeGuardian("S", "shark", 0, 0, "a", 1);
    const healthy = new FakeEnemy("H", "swimmer", 50);
    const wounded = new FakeEnemy("W", "swimmer", 60);
    wounded.health = 10;
    shark.targetId = "H";
    updateFrenzy(shark, [healthy, wounded], 0);
    expect(shark.attackSpeedBonus).toBe(0);
    shark.targetId = "W";
    updateFrenzy(shark, [healthy, wounded], 0);
    expect(shark.attackSpeedBonus).toBeCloseTo(0.35);
    expect(shark.stats.cooldownMs).toBeCloseTo(GUARDIANS.shark.cooldownMs / 1.35);
    shark.upgrade("a", 2);
    const more = new FakeEnemy("M", "swimmer", 70);
    more.health = 5;
    updateFrenzy(shark, [healthy, wounded, more], 0);
    expect(shark.attackSpeedBonus).toBeCloseTo(0.35 + 0.12 * 2);
    for (let index = 0; index < 5; index += 1) {
      const extra = new FakeEnemy(`X${index}`, "swimmer", 80 + index);
      extra.health = 1;
      healthy.health = 1;
    }
    const crowd = Array.from({ length: 6 }, (_, index) => {
      const enemy = new FakeEnemy(`C${index}`, "swimmer", 30 + index);
      enemy.health = 1;
      return enemy;
    });
    updateFrenzy(shark, [wounded, ...crowd], 0);
    expect(shark.attackSpeedBonus).toBeCloseTo(0.6);
    expect(targetPolicyFor(shark, 0).mode).toBe("wounded");
  });

  it("marks the biggest threat, boosts damage only for the shark, and remarks when the prey dies", () => {
    const shark = new FakeGuardian("S", "shark", 0, 0, "b", 2);
    const swimmer = new FakeEnemy("A", "swimmer", 50);
    const elite = new FakeEnemy("E", "moray", 40);
    const events: BehaviorEvent[] = [];
    updateMark(shark, [swimmer, elite], hooks(0, events));
    expect(shark.runtime.preyId).toBe("E");
    expect(events[0]).toMatchObject({ type: "mark", enemyId: "E" });
    expect(elite.status.markMultiplier("S", 10)).toBeCloseTo(1.3);
    expect(elite.status.markMultiplier("OTHER", 10)).toBe(1);
    expect(targetPolicyFor(shark, 10).markedId).toBe("E");

    registerSharkHit(shark, elite, 20);
    expect(elite.status.markMultiplier("S", 20)).toBeCloseTo(1.3);
    registerSharkHit(shark, elite, 40);
    expect(elite.status.markMultiplier("S", 40)).toBeCloseTo(1.3 * 1.1);
    for (let hit = 0; hit < 10; hit += 1) registerSharkHit(shark, elite, 50 + hit);
    expect(elite.status.markMultiplier("S", 70)).toBeCloseTo(1.3 * 1.5);

    elite.dead = true;
    updateMark(shark, [swimmer, elite], hooks(100, events));
    expect(shark.runtime.preyId).toBe("A");
    expect(swimmer.status.isMarked(101)).toBe(true);
  });

  it("respects the mark cooldown when the prey simply expires", () => {
    const shark = new FakeGuardian("S", "shark", 0, 0, "b", 1);
    const swimmer = new FakeEnemy("A", "swimmer", 50);
    const mark = shark.stats.mark!;
    updateMark(shark, [swimmer], hooks(0));
    expect(shark.runtime.preyId).toBe("A");
    updateMark(shark, [swimmer], hooks(mark.durationMs + 1));
    expect(shark.runtime.preyId).toBeNull();
    updateMark(shark, [swimmer], hooks(mark.cooldownMs + 1));
    expect(shark.runtime.preyId).toBe("A");
  });
});

describe("turtle push wave", () => {
  it("pushes commons back along the path, elites half, slows the boss, and waits for the cooldown", () => {
    const turtle = new FakeGuardian("T", "sea-turtle", 400, 0, "b", 2);
    const wave = turtle.stats.pushWave!;
    const common = new FakeEnemy("A", "swimmer", 420);
    const elite = new FakeEnemy("E", "moray", 430);
    const boss = new FakeEnemy("Z", "tidebreaker", 440);
    const far = new FakeEnemy("F", "swimmer", 900);
    const events: BehaviorEvent[] = [];
    updatePushWave(turtle, [common, elite, boss, far], hooks(0, events));
    expect(common.pathDistance).toBe(420 - wave.distance);
    expect(elite.pathDistance).toBe(430 - wave.distance * wave.eliteFactor);
    expect(boss.pathDistance).toBe(440);
    expect(boss.status.slowFactor(1)).toBeLessThan(1);
    expect(far.pathDistance).toBe(900);
    expect(events[0]).toMatchObject({ type: "pushWave", pushedIds: ["A", "E"] });
    updatePushWave(turtle, [common], hooks(wave.cooldownMs - 1));
    expect(common.pathDistance).toBe(420 - wave.distance);
    updatePushWave(turtle, [common], hooks(wave.cooldownMs));
    expect(common.pathDistance).toBe(420 - wave.distance * 2);
  });
});

describe("stonefish trap", () => {
  it("poisons on Veneno I and spawns the toxic cloud on Veneno II", () => {
    const fish = new FakeGuardian("P", "stonefish", 300, 0, "a", 1, 0);
    const trap = fish.stats.trap!;
    const victim = new FakeEnemy("A", "swimmer", 310);
    const damaged: Array<{ id: string; amount: number }> = [];
    updateTrap(fish, [victim], hooks(trap.armMs, [], damaged));
    updateTrap(fish, [victim], hooks(trap.armMs + 1, [], damaged));
    expect(damaged).toEqual([{ id: "A", amount: trap.damage }]);
    expect(victim.status.isPoisoned(trap.armMs + 2)).toBe(true);
    expect(victim.status.drainPoison(trap.armMs + 1 + trap.poison!.tickMs)).toBe(trap.poison!.damagePerTick);

    const garden = new FakeGuardian("G", "stonefish", 300, 0, "a", 2, 0);
    const clouds: string[] = [];
    updateTrap(garden, [victim], { ...hooks(trap.armMs), spawnCloud: (ownerId) => clouds.push(ownerId) });
    updateTrap(garden, [victim], { ...hooks(trap.armMs + 1), spawnCloud: (ownerId) => clouds.push(ownerId) });
    expect(clouds).toEqual(["G"]);
  });

  it("stuns and knocks back on Emboscada II, sparing the boss from the push", () => {
    const fish = new FakeGuardian("P", "stonefish", 300, 0, "b", 2, 0);
    const trap = fish.stats.trap!;
    const first = new FakeEnemy("A", "swimmer", 305);
    const second = new FakeEnemy("B", "swimmer", 310);
    const boss = new FakeEnemy("Z", "tidebreaker", 315);
    const events: BehaviorEvent[] = [];
    updateTrap(fish, [first, second, boss], hooks(trap.armMs, events));
    const fireAt = trap.armMs + 1;
    updateTrap(fish, [first, second, boss], hooks(fireAt, events));
    expect(events.some((event) => event.type === "trapTrigger")).toBe(true);
    expect(first.status.isStunned(fireAt + 1)).toBe(true);
    expect(first.pathDistance).toBe(305 - trap.knockback!.distance);
    expect(boss.pathDistance).toBe(315);
    expect(boss.status.isStunned(fireAt + 1)).toBe(true);
    expect(boss.status.isStunned(fireAt + trap.stun!.durationMs * trap.stun!.bossFactor + 5)).toBe(false);
  });
});
