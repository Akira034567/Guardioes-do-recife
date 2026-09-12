import { describe, expect, it } from "vitest";
import { BossEncounter, bossDefinitionOf, DEFAULT_BOSS } from "../src/game/core/BossEncounter";
import { CurrentSystem } from "../src/game/core/CurrentSystem";
import { NEUTRAL_MODS, type AbilityEnemy, type EnemyAbilityWorld } from "../src/game/core/EnemyAbilities";
import { EnemyStatus } from "../src/game/core/EnemyStatus";
import { Match } from "../src/game/core/match/Match";
import type { MatchEvent } from "../src/game/core/match/MatchEvents";
import { ENEMIES, resolveEnemy } from "../src/game/data/enemies";
import { RECIFE_ONE } from "../src/game/data/levels";
import type { BossDefinition, EnemyAbility, ResolvedEnemyDefinition } from "../src/game/types";

class BossEnemy implements AbilityEnemy {
  x = 0;
  y = 0;
  pathDistance = 0;
  dead = false;
  reachedGoal = false;
  blockedById: string | null = null;
  hitOnce = false;
  health: number;
  readonly status = new EnemyStatus();
  readonly mods = { ...NEUTRAL_MODS };
  readonly abilityState = new Map<string, unknown>();
  readonly abilities: EnemyAbility[];
  readonly definition: ResolvedEnemyDefinition;
  readonly pathId = "main";

  constructor(
    readonly id: string,
    boss?: BossDefinition,
  ) {
    this.definition = { ...resolveEnemy(ENEMIES.tidebreaker), boss };
    this.health = this.definition.maxHealth;
    this.abilities = [...this.definition.abilities];
  }

  setPathDistance(distance: number): void {
    this.pathDistance = distance;
  }

  clearBlocked(): void {
    this.blockedById = null;
  }
}

const world = (enemies: BossEnemy[]): EnemyAbilityWorld<BossEnemy> => ({
  now: 0,
  enemies,
  guardians: [],
  currents: new CurrentSystem(),
  spawnEnemy: () => {},
  heal: () => {},
  emit: () => {},
});

const THREE_PHASES: BossDefinition = {
  title: "O Quebra-Marés",
  phases: [
    { id: "calma", hpThreshold: 1 },
    { id: "agitada", hpThreshold: 0.7, statMultipliers: { speed: 1.2 }, announcement: "A maré vira!", addAbilities: [{ type: "speedBurst", intervalMs: 1000, durationMs: 300, multiplier: 1.5 }] },
    { id: "furiosa", hpThreshold: 0.35, statMultipliers: { speed: 1.3 }, announcement: "Fúria abissal!" },
  ],
};

describe("BossEncounter", () => {
  it("gives any boss a single default phase when none is declared", () => {
    expect(bossDefinitionOf(ENEMIES.tidebreaker)).toEqual(DEFAULT_BOSS);
    expect(bossDefinitionOf(ENEMIES.swimmer)).toBeNull();
    const boss = new BossEnemy("E1");
    const encounter = new BossEncounter<BossEnemy>();
    expect(encounter.onSpawn(boss)).toEqual([
      { type: "bossStarted", enemyId: "E1", name: "Quebra-Marés", title: "Quebra-Marés", phaseCount: 1 },
    ]);
    boss.health = 1;
    expect(encounter.onDamaged(boss, world([boss]))).toEqual([]);
  });

  it("crosses each threshold once, in order, even with one huge hit", () => {
    const boss = new BossEnemy("E1", THREE_PHASES);
    const encounter = new BossEncounter<BossEnemy>();
    encounter.onSpawn(boss);
    boss.health = boss.definition.maxHealth * 0.8;
    expect(encounter.onDamaged(boss, world([boss]))).toEqual([]);
    boss.health = boss.definition.maxHealth * 0.1;
    const events = encounter.onDamaged(boss, world([boss]));
    expect(events.map((event) => event.type === "bossPhaseChanged" && event.phaseIndex)).toEqual([1, 2]);
    expect(boss.mods.speed, "os dois multiplicadores da travessia se acumulam").toBeCloseTo(1.2 * 1.3);
    expect(boss.abilities.some((ability) => ability.type === "speedBurst")).toBe(true);
    expect(encounter.onDamaged(boss, world([boss]))).toEqual([]);
  });

  it("reports the most advanced boss for the HUD bar", () => {
    const first = new BossEnemy("E1", THREE_PHASES);
    const second = new BossEnemy("E2", THREE_PHASES);
    const encounter = new BossEncounter<BossEnemy>();
    encounter.onSpawn(first);
    encounter.onSpawn(second);
    second.health = second.definition.maxHealth * 0.3;
    encounter.onDamaged(second, world([first, second]));
    expect(encounter.snapshot()).toMatchObject({ id: "E2", phaseIndex: 2, phaseCount: 3, title: "O Quebra-Marés" });
    second.dead = true;
    expect(encounter.snapshot()?.id).toBe("E1");
  });

  it("pays the extra reward once when defeated and nothing when it leaks", () => {
    const defeated = new BossEnemy("E1", { phases: [{ id: "unica", hpThreshold: 1 }], rewards: { pearls: 40 } });
    const leaked = new BossEnemy("E2", { phases: [{ id: "unica", hpThreshold: 1 }], rewards: { pearls: 40 } });
    const encounter = new BossEncounter<BossEnemy>();
    encounter.onSpawn(defeated);
    encounter.onSpawn(leaked);
    defeated.dead = true;
    expect(encounter.onRemoved(defeated)).toEqual([{ type: "bossDefeated", enemyId: "E1", extraPearls: 40 }]);
    expect(encounter.onRemoved(defeated), "removido duas vezes não paga de novo").toEqual([]);
    leaked.reachedGoal = true;
    expect(encounter.onRemoved(leaked)).toEqual([{ type: "bossLeaked", enemyId: "E2" }]);
    expect(encounter.active).toBe(false);
  });

  it("ignores damage after death", () => {
    const boss = new BossEnemy("E1", THREE_PHASES);
    const encounter = new BossEncounter<BossEnemy>();
    encounter.onSpawn(boss);
    boss.health = 0;
    boss.dead = true;
    expect(encounter.onDamaged(boss, world([boss]))).toEqual([]);
  });
});

describe("boss events in a real match", () => {
  it("announces the Tidebreaker, tracks its bar and reports it defeated", () => {
    const events: MatchEvent[] = [];
    // Chefe frágil: o objetivo do teste são os eventos do encontro, não o balanceamento.
    const match = new Match({ ...RECIFE_ONE, reefHealth: 999, enemyOverrides: { tidebreaker: { maxHealth: 40 } } }, { startWaveIndex: 4 });
    match.setListener((event) => events.push(event));
    match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: 375, y: 245 });
    while (match.status === "running" && match.now < 200_000) match.tick();
    const started = events.find((event) => event.type === "bossStarted");
    expect(started).toMatchObject({ enemyId: "tidebreaker", name: "Quebra-Marés", phaseCount: 1 });
    expect(events.some((event) => event.type === "bossDefeated")).toBe(true);
    expect(match.stats.bossesDefeated).toContain("tidebreaker");
    expect(match.snapshot().boss, "sem chefe em campo, a barra some").toBeNull();
  });
});
