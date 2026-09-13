import { describe, expect, it } from "vitest";
import { Match } from "../src/game/core/match/Match";
import type { MatchEvent } from "../src/game/core/match/MatchEvents";
import { CORRUPTED_CORALS } from "../src/game/data/bossWeakPoints";
import { DIFFICULTIES, resolveLevelForDifficulty } from "../src/game/data/difficulty";
import { RECIFE_ONE } from "../src/game/data/levels";
import { weakPointBurstDamage, weakPointDefinition, weakPointWorldPosition } from "../src/game/core/WeakPoints";
import { ENEMIES, resolveEnemy } from "../src/game/data/enemies";
import { tierOf, isWeakPoint } from "../src/game/core/Targeting";
import type { LevelDefinition } from "../src/game/types";

/** Fase mínima com um único chefe, para o encontro ser o objeto do teste e mais nada. */
const BOSS_LEVEL: LevelDefinition = {
  ...RECIFE_ONE,
  id: "boss-tiny",
  startingPearls: 0,
  reefHealth: 20,
  initialWaveDelayMs: 100,
  betweenWaveDelayMs: 100,
  enemyScaling: { health: 1, speed: 1, reward: 1 },
  enemyOverrides: { tidebreaker: { weakPoints: CORRUPTED_CORALS } },
  waypoints: [
    { x: -40, y: 300 },
    { x: 2000, y: 300 },
  ],
  currents: [],
  waves: [{ name: "chefe", groups: [{ enemyId: "tidebreaker", count: 1, intervalMs: 100, delayMs: 0 }] }],
};

function record(match: Match): MatchEvent[] {
  const events: MatchEvent[] = [];
  match.setListener((event) => events.push(event));
  return events;
}

function run(match: Match, ms: number): void {
  const ticks = Math.ceil(ms / match.dtMs);
  for (let index = 0; index < ticks; index += 1) match.tick();
}

describe("Corais Corrompidos", () => {
  it("nasce junto com o chefe, mas fora da lista de inimigos", () => {
    const match = new Match(BOSS_LEVEL);
    const events = record(match);
    run(match, 400);

    expect(match.weakPoints).toHaveLength(CORRUPTED_CORALS.count);
    expect(events.filter((event) => event.type === "weakPointSpawned")).toHaveLength(CORRUPTED_CORALS.count);
    // O que decide vitória, dano ao Recife e recompensa é `enemies` — e os corais não estão lá.
    expect(match.enemies.filter((enemy) => enemy.isWeakPoint)).toHaveLength(0);
    expect(match.snapshot().aliveEnemies).toBe(1);
  });

  it("reporta o placar de corais no chefe", () => {
    const match = new Match(BOSS_LEVEL);
    run(match, 400);
    expect(match.snapshot().boss?.weakPoints).toEqual({ total: 4, remaining: 4 });
  });

  it("aplica o estouro no chefe ao romper um coral, sem pagar abate", () => {
    const match = new Match(BOSS_LEVEL);
    const events = record(match);
    run(match, 400);

    const boss = match.enemies[0];
    const coral = match.weakPoints[0];
    const bossHealthBefore = boss.health;
    const pearlsBefore = match.snapshot().pearls;

    match.execute({ type: "debug.damageEnemy", enemyId: coral.id, amount: coral.definition.maxHealth * 10 });
    run(match, 40);

    const destroyed = events.filter((event) => event.type === "weakPointDestroyed");
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]).toMatchObject({ reason: "broken" });

    const expected = weakPointBurstDamage(CORRUPTED_CORALS, boss.definition);
    expect(bossHealthBefore - boss.health).toBeGreaterThanOrEqual(expected);
    expect(match.weakPoints).toHaveLength(3);

    // Coral não é inimigo de onda: nada de pérola, nada de `enemyKilled`, nada no bestiário.
    expect(match.snapshot().pearls).toBe(pearlsBefore);
    expect(events.some((event) => event.type === "enemyKilled" && event.id === coral.id)).toBe(false);
    expect(match.snapshot().stats.kills).not.toHaveProperty(coral.definition.id);
  });

  it("deixa a fase ser vencida mesmo com corais vivos", () => {
    const match = new Match(BOSS_LEVEL);
    run(match, 400);
    expect(match.weakPoints.length).toBeGreaterThan(0);

    match.execute({ type: "debug.killAll" });
    run(match, 600);

    // Se os corais contassem como inimigos vivos, a onda nunca fecharia e a vitória travava.
    expect(match.status).toBe("victory");
    expect(match.weakPoints).toHaveLength(0);
  });

  it("leva os corais junto quando o chefe sai de campo", () => {
    const match = new Match(BOSS_LEVEL);
    const events = record(match);
    run(match, 400);
    match.execute({ type: "debug.killAll" });
    run(match, 40);

    const orphaned = events.filter((event) => event.type === "weakPointDestroyed" && event.reason === "parentGone");
    expect(orphaned).toHaveLength(CORRUPTED_CORALS.count);
  });

  it("conta o dano no coral como dano do jogador", () => {
    const match = new Match(BOSS_LEVEL);
    run(match, 400);
    const before = match.snapshot().stats.damageDealt;
    match.execute({ type: "debug.damageEnemy", enemyId: match.weakPoints[0].id, amount: 10 });
    run(match, 40);
    expect(match.snapshot().stats.damageDealt).toBeGreaterThan(before);
  });
});

describe("plano de pontos fracos", () => {
  const whale = resolveEnemy(ENEMIES.tidebreaker);

  it("deriva vida e estouro da vida do pai", () => {
    const definition = weakPointDefinition(CORRUPTED_CORALS, whale);
    expect(definition.maxHealth).toBe(Math.round(whale.maxHealth * CORRUPTED_CORALS.hpFraction));
    expect(weakPointBurstDamage(CORRUPTED_CORALS, whale)).toBe(Math.round(whale.maxHealth * CORRUPTED_CORALS.damageOnBreakFraction));
  });

  it("não paga recompensa nem fere o Recife", () => {
    const definition = weakPointDefinition(CORRUPTED_CORALS, whale);
    expect(definition.reward).toBe(0);
    expect(definition.reefDamage).toBe(0);
    expect(definition.speed).toBe(0);
    expect(definition.isBoss).toBe(false);
    expect(isWeakPoint({ definition })).toBe(true);
    expect(tierOf({ definition })).toBe("weakPoint");
  });

  it("espelha as âncoras quando o chefe nada para a esquerda", () => {
    const anchor = CORRUPTED_CORALS.anchors[0];
    const direita = weakPointWorldPosition({ x: 100, y: 100, heading: 0 }, anchor, 10);
    const esquerda = weakPointWorldPosition({ x: 100, y: 100, heading: Math.PI }, anchor, 10);
    // O coral fica nas COSTAS nos dois casos: o deslocamento horizontal inverte com o corpo.
    expect(direita.x - 100).toBeCloseTo(-(esquerda.x - 100));
    expect(direita.y - 100).toBeCloseTo(esquerda.y - 100);
  });

  it("acompanha o chefe em translação", () => {
    const anchor = CORRUPTED_CORALS.anchors[1];
    const a = weakPointWorldPosition({ x: 0, y: 0, heading: 0 }, anchor, 10);
    const b = weakPointWorldPosition({ x: 50, y: 30, heading: 0 }, anchor, 10);
    expect(b.x - a.x).toBeCloseTo(50);
    expect(b.y - a.y).toBeCloseTo(30);
  });
});

describe("gate de dificuldade dos pontos fracos", () => {
  it("não dá corais no Normal", () => {
    const level = resolveLevelForDifficulty(RECIFE_ONE, DIFFICULTIES.normal);
    expect(level.enemyOverrides?.tidebreaker?.weakPoints).toBeUndefined();
  });

  it("dá corais no Difícil e no Abissal", () => {
    expect(resolveLevelForDifficulty(RECIFE_ONE, DIFFICULTIES.dificil).enemyOverrides?.tidebreaker?.weakPoints).toBeDefined();
    expect(resolveLevelForDifficulty(RECIFE_ONE, DIFFICULTIES.abissal).enemyOverrides?.tidebreaker?.weakPoints).toBeDefined();
  });

  it("não muta a fase original", () => {
    const before = JSON.stringify(RECIFE_ONE.enemyOverrides ?? {});
    resolveLevelForDifficulty(RECIFE_ONE, DIFFICULTIES.abissal);
    expect(JSON.stringify(RECIFE_ONE.enemyOverrides ?? {})).toBe(before);
  });
});
