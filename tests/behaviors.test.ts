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
import { focusedDamage, TRAP_TRIGGER_MS } from "../src/game/core/TrapCore";
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
    expect(shark.attackSpeedBonus).toBeCloseTo(0.4);
    expect(shark.stats.cooldownMs).toBeCloseTo(GUARDIANS.shark.cooldownMs / 1.4);
    shark.upgrade("a", 2);
    const more = new FakeEnemy("M", "swimmer", 70);
    more.health = 5;
    updateFrenzy(shark, [healthy, wounded, more], 0);
    expect(shark.attackSpeedBonus).toBeCloseTo(0.4 + 0.12 * 2);
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
    expect(shark.attackSpeedBonus).toBeCloseTo(0.65);
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
    expect(elite.status.markMultiplier("S", 10)).toBeCloseTo(1.35);
    expect(elite.status.markMultiplier("OTHER", 10)).toBe(1);
    expect(targetPolicyFor(shark, 10).markedId).toBe("E");

    registerSharkHit(shark, elite, 20);
    expect(elite.status.markMultiplier("S", 20)).toBeCloseTo(1.35);
    registerSharkHit(shark, elite, 40);
    expect(elite.status.markMultiplier("S", 40)).toBeCloseTo(1.35 * 1.1);
    for (let hit = 0; hit < 10; hit += 1) registerSharkHit(shark, elite, 50 + hit);
    expect(elite.status.markMultiplier("S", 70)).toBeCloseTo(1.35 * 1.5);

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

describe("emboscada do Peixe-Pedra", () => {
  it("fica camuflado, abre os espinhos quando alguém entra e só então dá o bote", () => {
    const fish = new FakeGuardian("P", "stonefish", 300, 0, null, 0, 0);
    const trap = fish.stats.trap!;
    const victim = new FakeEnemy("A", "swimmer", 310);
    const events: BehaviorEvent[] = [];
    const damaged: Array<{ id: string; amount: number }> = [];

    // Antes de se acomodar não acontece nada, mesmo com inimigo em cima.
    updateTrap(fish, [victim], hooks(trap.settleMs - 1, events, damaged));
    expect(damaged).toEqual([]);

    // Acomodou: agora está camuflado. O inimigo na zona abre os espinhos, mas o bote ainda não saiu.
    updateTrap(fish, [victim], hooks(trap.settleMs, events, damaged));
    updateTrap(fish, [victim], hooks(trap.settleMs + 1, events, damaged));
    expect(events.some((event) => event.type === "trapPhase" && event.phase === "arming")).toBe(true);
    expect(damaged, "os espinhos ainda estão abrindo").toEqual([]);

    // Passada a abertura, o bote sai e envenena.
    const fireAt = trap.settleMs + 1 + trap.armMs;
    updateTrap(fish, [victim], hooks(fireAt, events, damaged));
    expect(damaged).toEqual([{ id: "A", amount: trap.damage }]);
    expect(victim.status.isPoisoned(fireAt + 1)).toBe(true);
  });

  it("é um ciclo: depois da recarga ele volta a se camuflar e emboscar de novo", () => {
    const fish = new FakeGuardian("P", "stonefish", 300, 0, null, 0, 0);
    const trap = fish.stats.trap!;
    const victim = new FakeEnemy("A", "swimmer", 310);
    const damaged: Array<{ id: string; amount: number }> = [];
    // Roda tempo suficiente para dois botes: acomodar + (armar + bote + recarga) × 2, com folga.
    const step = 50;
    for (let now = 0; now <= trap.settleMs + (trap.armMs + trap.cooldownMs + TRAP_TRIGGER_MS) * 2 + 400; now += step) {
      updateTrap(fish, [victim], hooks(now, [], damaged));
    }
    // A armadilha antiga daria UM golpe e ficaria inútil; o emboscador repete.
    expect(damaged.length, "o emboscador dá mais de um bote na mesma vida").toBeGreaterThanOrEqual(2);
  });

  it("Jardim Tóxico solta a nuvem; Predador ignora armadura e cobra pela vida do grandão", () => {
    const garden = new FakeGuardian("G", "stonefish", 300, 0, "a", 1, 0);
    const gardenTrap = garden.stats.trap!;
    const victim = new FakeEnemy("A", "swimmer", 310);
    const clouds: string[] = [];
    const cloudHooks = (now: number) => ({ ...hooks(now), spawnCloud: (ownerId: string) => clouds.push(ownerId) });
    updateTrap(garden, [victim], cloudHooks(gardenTrap.settleMs));
    updateTrap(garden, [victim], cloudHooks(gardenTrap.settleMs + 1));
    updateTrap(garden, [victim], cloudHooks(gardenTrap.settleMs + 1 + gardenTrap.armMs));
    expect(clouds).toEqual(["G"]);
    expect(gardenTrap.cloud?.slowFactor, "a nuvem também segura quem atravessa").toBeLessThan(1);

    // Predador II: o bônus é pela vida MÁXIMA do alvo, com teto — um chefe não pode cair num bote.
    const predator = new FakeGuardian("B", "stonefish", 300, 0, "b", 2, 0);
    const trap = predator.stats.trap!;
    expect(trap.armorPiercing).toBe(true);
    const focus = trap.focus!;
    expect(focusedDamage(trap.damage, focus, 210)).toBeCloseTo(trap.damage + 21);
    expect(focusedDamage(trap.damage, focus, 1601), "o teto segura o chefe").toBeCloseTo(trap.damage + focus.maxBonus);
  });
});

