import { describe, expect, it } from "vitest";
import { CurrentSystem } from "../src/game/core/CurrentSystem";
import {
  EnemyAbilitySystem,
  NEUTRAL_MODS,
  type AbilityEnemy,
  type AbilityGuardian,
  type EnemyAbilityEvent,
  type EnemyAbilityWorld,
} from "../src/game/core/EnemyAbilities";
import { EnemyStatus } from "../src/game/core/EnemyStatus";
import type { StatusEffectInput } from "../src/game/core/StatusEffects";
import { BOSS_CURRENT } from "../src/game/data/balance";
import { ENEMIES, resolveEnemy } from "../src/game/data/enemies";
import { RECIFE_ONE } from "../src/game/data/levels";
import type { EnemyAbility, EnemyId, ResolvedEnemyDefinition } from "../src/game/types";

class TestEnemy implements AbilityEnemy {
  x = 0;
  y = 0;
  pathDistance = 0;
  dead = false;
  reachedGoal = false;
  blockedById: string | null = null;
  hitOnce = false;
  health: number;
  readonly status: EnemyStatus;
  readonly mods = { ...NEUTRAL_MODS };
  readonly abilityState = new Map<string, unknown>();
  readonly abilities: EnemyAbility[];
  readonly definition: ResolvedEnemyDefinition;

  constructor(
    readonly id: string,
    enemyId: EnemyId,
    abilities: EnemyAbility[] = [],
    readonly pathId = "main",
  ) {
    this.definition = resolveEnemy(ENEMIES[enemyId]);
    this.health = this.definition.maxHealth;
    this.status = new EnemyStatus(this.definition.slowResistance ?? 0);
    this.abilities = abilities.length > 0 ? [...abilities] : [...this.definition.abilities];
  }

  setPathDistance(distance: number): void {
    this.pathDistance = Math.max(0, distance);
  }

  clearBlocked(): void {
    this.blockedById = null;
  }
}

class TestGuardian implements AbilityGuardian {
  readonly applied: StatusEffectInput[] = [];
  constructor(
    readonly id: string,
    readonly x = 0,
    readonly y = 0,
  ) {}
  applyStatus(input: StatusEffectInput): void {
    this.applied.push(input);
  }
}

interface Harness {
  system: EnemyAbilitySystem<TestEnemy>;
  world: () => EnemyAbilityWorld<TestEnemy>;
  enemies: TestEnemy[];
  guardians: TestGuardian[];
  currents: CurrentSystem;
  events: EnemyAbilityEvent[];
  spawned: Array<{ enemyId: EnemyId; pathDistance: number }>;
  advance(ms: number, stepMs?: number): void;
  now: () => number;
}

function harness(enemies: TestEnemy[], guardians: TestGuardian[] = []): Harness {
  const system = new EnemyAbilitySystem<TestEnemy>();
  const currents = CurrentSystem.fromLevel(RECIFE_ONE.currents);
  const events: EnemyAbilityEvent[] = [];
  const spawned: Array<{ enemyId: EnemyId; pathDistance: number }> = [];
  let now = 0;
  const world = (): EnemyAbilityWorld<TestEnemy> => ({
    now,
    enemies,
    guardians,
    currents,
    spawnEnemy: (enemyId, at) => spawned.push({ enemyId, pathDistance: at.pathDistance }),
    heal: (enemy, amount) => (enemy.health = Math.min(enemy.definition.maxHealth, enemy.health + amount)),
    emit: (event) => events.push(event),
  });
  enemies.forEach((enemy) => system.register(enemy, world()));
  return {
    system,
    world,
    enemies,
    guardians,
    currents,
    events,
    spawned,
    now: () => now,
    advance(ms, stepMs = 1000 / 60) {
      const steps = Math.round(ms / stepMs);
      for (let index = 0; index < steps; index += 1) {
        now += stepMs;
        system.worldTick(stepMs, world());
        system.tick(stepMs, world());
      }
    },
  };
}

describe("reverseCurrents (Quebra-Marés)", () => {
  it("is declared in data with the balance numbers", () => {
    expect(resolveEnemy(ENEMIES.tidebreaker).abilities).toEqual([
      { type: "reverseCurrents", cycleMs: BOSS_CURRENT.cycleMs, reverseMs: BOSS_CURRENT.reverseMs },
    ]);
  });

  it("follows the original cycle: normal, reversed for reverseMs, then normal again", () => {
    const boss = new TestEnemy("E1", "tidebreaker");
    const test = harness([boss]);
    test.advance(BOSS_CURRENT.cycleMs - 100);
    expect(test.currents.reversed).toBe(false);
    test.advance(200);
    expect(test.currents.reversed).toBe(true);
    test.advance(BOSS_CURRENT.reverseMs - 200);
    expect(test.currents.reversed).toBe(true);
    test.advance(300);
    expect(test.currents.reversed).toBe(false);
    expect(test.events.filter((event) => event.type === "currentsReversed")).toHaveLength(2);
    // O ciclo recomeça do zero depois de voltar ao normal.
    test.advance(BOSS_CURRENT.cycleMs - 500);
    expect(test.currents.reversed).toBe(false);
    test.advance(600);
    expect(test.currents.reversed).toBe(true);
  });

  it("resets when no boss is alive and restores the current the moment one dies", () => {
    const boss = new TestEnemy("E1", "tidebreaker");
    const test = harness([boss]);
    test.advance(BOSS_CURRENT.cycleMs + 100);
    expect(test.currents.reversed).toBe(true);
    boss.dead = true;
    test.system.died(boss, test.world());
    expect(test.currents.reversed, "a corrente se estabiliza assim que o chefe cai").toBe(false);
    test.advance(BOSS_CURRENT.cycleMs + 100);
    expect(test.currents.reversed).toBe(false);
  });

  it("shares a single cycle between two bosses alive at once", () => {
    const first = new TestEnemy("E1", "tidebreaker");
    const second = new TestEnemy("E2", "tidebreaker");
    const test = harness([first, second]);
    test.advance(BOSS_CURRENT.cycleMs + 100);
    expect(test.currents.reversed).toBe(true);
    expect(test.events.filter((event) => event.type === "currentsReversed"), "um único evento para os dois chefes").toHaveLength(1);
  });
});

describe("enemy ability components", () => {
  it("regenerates only after the delay since the last hit and never past the cap", () => {
    const enemy = new TestEnemy("E1", "moray", [{ type: "regen", hpPerSecond: 50, delayAfterHitMs: 1000, maxFraction: 0.9 }]);
    enemy.health = 100;
    const test = harness([enemy]);
    test.system.damaged(enemy, 10, test.world());
    test.advance(500);
    expect(enemy.health).toBe(100);
    test.advance(1000);
    expect(enemy.health).toBeGreaterThan(100);
    enemy.health = enemy.definition.maxHealth * 0.9;
    test.advance(2000);
    expect(enemy.health).toBeCloseTo(enemy.definition.maxHealth * 0.9);
  });

  it("enrages once below the threshold", () => {
    const enemy = new TestEnemy("E1", "swimmer", [{ type: "enrageBelowHp", threshold: 0.5, speedMultiplier: 1.5, armorBonus: 2 }]);
    const test = harness([enemy]);
    enemy.health = enemy.definition.maxHealth * 0.6;
    test.system.damaged(enemy, 1, test.world());
    expect(enemy.mods.speed).toBe(1);
    enemy.health = enemy.definition.maxHealth * 0.4;
    test.system.damaged(enemy, 1, test.world());
    test.system.damaged(enemy, 1, test.world());
    expect(enemy.mods.speed).toBeCloseTo(1.5);
    expect(enemy.mods.armorBonus).toBe(2);
    expect(test.events.filter((event) => event.type === "enraged")).toHaveLength(1);
  });

  it("shields nearby allies and skips the source itself", () => {
    const support = new TestEnemy("E1", "moray", [{ type: "shieldAllies", radius: 100, damageReduction: 0.3 }]);
    const near = new TestEnemy("E2", "swimmer", []);
    const far = new TestEnemy("E3", "swimmer", []);
    far.x = 500;
    const test = harness([support, near, far]);
    test.advance(100);
    expect(near.status.shield(test.now())).toBeCloseTo(0.3);
    expect(far.status.shield(test.now())).toBe(0);
    expect(support.status.shield(test.now())).toBe(0);
  });

  it("disrupts guardians in range on its own interval", () => {
    const enemy = new TestEnemy("E1", "moray", [
      { type: "disruptGuardians", radius: 120, intervalMs: 2000, attackSpeedMultiplier: 0.6, durationMs: 1500 },
    ]);
    const near = new TestGuardian("G1", 50, 0);
    const far = new TestGuardian("G2", 400, 0);
    const test = harness([enemy], [near, far]);
    test.advance(100);
    expect(near.applied).toHaveLength(1);
    expect(near.applied[0]).toMatchObject({ type: "attackSpeedBuff", strength: 0.6, sourceId: "E1" });
    expect(far.applied).toHaveLength(0);
    test.advance(1000);
    expect(near.applied).toHaveLength(1);
    test.advance(1500);
    expect(near.applied).toHaveLength(2);
  });

  it("hides a stealth enemy until it is revealed", () => {
    const enemy = new TestEnemy("E1", "dartfish", [{ type: "stealth" }]);
    const test = harness([enemy]);
    test.advance(100);
    expect(enemy.mods.hidden).toBe(true);
    enemy.status.reveal(1000, test.now());
    test.advance(100);
    expect(enemy.mods.hidden).toBe(false);
  });

  it("keeps the ghost jellyfish hidden until a blocker grabs it, and then for good", () => {
    const enemy = new TestEnemy("E1", "ghostJelly", [...resolveEnemy(ENEMIES.ghostJelly).abilities]);
    const test = harness([enemy]);
    test.advance(100);
    expect(enemy.mods.hidden).toBe(true);

    // Dano por área NÃO a expõe: `untilDamaged` é falso de propósito.
    enemy.hitOnce = true;
    test.advance(100);
    expect(enemy.mods.hidden).toBe(true);

    // Encostar num bloqueador da rota expõe — e soltar não a esconde de novo.
    enemy.blockedById = "puffer-1";
    test.advance(100);
    expect(enemy.mods.hidden).toBe(false);
    enemy.blockedById = null;
    test.advance(1000);
    expect(enemy.mods.hidden).toBe(false);
  });

  it("also opens the ghost jellyfish with the dolphin sonar alone", () => {
    const enemy = new TestEnemy("E1", "ghostJelly", [...resolveEnemy(ENEMIES.ghostJelly).abilities]);
    const test = harness([enemy]);
    test.advance(100);
    expect(enemy.mods.hidden).toBe(true);
    enemy.status.reveal(1000, test.now());
    test.advance(100);
    expect(enemy.mods.hidden).toBe(false);
    // Passada a revelação, ela volta a sumir: o sonar é uma janela, o bloqueio é definitivo.
    test.advance(1200);
    expect(enemy.mods.hidden).toBe(true);
  });

  it("splits on death exactly once", () => {
    const enemy = new TestEnemy("E1", "shellback", [{ type: "splitOnDeath", enemyId: "minnow", count: 3, spreadPx: 10 }]);
    enemy.setPathDistance(400);
    const test = harness([enemy]);
    enemy.dead = true;
    test.system.died(enemy, test.world());
    test.system.died(enemy, test.world());
    expect(test.spawned).toHaveLength(3);
    expect(test.spawned.map((spawn) => spawn.pathDistance)).toEqual([390, 400, 410]);
    expect(test.events.filter((event) => event.type === "split")).toHaveLength(1);
  });

  it("changes phase once below the threshold and keeps the added ability running", () => {
    const enemy = new TestEnemy("E1", "tidebreaker", [
      {
        type: "phaseChangeAtHp",
        threshold: 0.5,
        statMultipliers: { speed: 1.4 },
        addAbilities: [{ type: "speedBurst", intervalMs: 1000, durationMs: 500, multiplier: 2 }],
        announcement: "O Quebra-Marés enfurece!",
      },
    ]);
    const test = harness([enemy]);
    enemy.health = enemy.definition.maxHealth * 0.4;
    test.system.damaged(enemy, 1, test.world());
    test.system.damaged(enemy, 1, test.world());
    expect(enemy.mods.speed).toBeCloseTo(1.4);
    expect(test.events.filter((event) => event.type === "phaseChanged")).toHaveLength(1);
    expect(enemy.abilities).toHaveLength(2);
    test.advance(1100);
    expect(enemy.mods.speed, "a rajada da nova fase multiplica a velocidade").toBeCloseTo(2.8);
    test.advance(600);
    expect(enemy.mods.speed).toBeCloseTo(1.4);
  });

  it("ignores dead enemies on tick", () => {
    const enemy = new TestEnemy("E1", "swimmer", [{ type: "speedBurst", intervalMs: 100, durationMs: 100, multiplier: 3 }]);
    const test = harness([enemy]);
    enemy.dead = true;
    test.advance(1000);
    expect(enemy.mods.speed).toBe(1);
  });
});
