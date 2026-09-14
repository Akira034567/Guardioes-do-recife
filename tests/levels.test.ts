import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../src/game/constants";
import { containsPoint } from "../src/game/core/CurrentField";
import { RoutePath } from "../src/game/core/RoutePath";
import { ENEMIES } from "../src/game/data/enemies";
import { GUARDIANS } from "../src/game/data/guardians";
import { getLevel, LEVELS, LEVEL_IDS, nextLevelId } from "../src/game/data/levels";
import type { EnemyId, LevelDefinition } from "../src/game/types";

const firstLevelWithEnemy = (enemyId: EnemyId): number =>
  LEVELS.findIndex((level) => level.waves.some((wave) => wave.groups.some((group) => group.enemyId === enemyId)));

const threatOf = (level: LevelDefinition): number =>
  level.waves.reduce(
    (total, wave) =>
      total +
      wave.groups.reduce(
        (sum, group) =>
          sum + group.count * (level.enemyOverrides?.[group.enemyId]?.maxHealth ?? ENEMIES[group.enemyId].maxHealth) * level.enemyScaling.health,
        0,
      ),
    0,
  );

describe("level registry", () => {
  it("exposes six ordered levels with unique ids and a linear next-level chain", () => {
    expect(LEVELS).toHaveLength(6);
    expect(new Set(LEVEL_IDS).size).toBe(6);
    LEVELS.forEach((level, index) => {
      expect(getLevel(level.id)).toBe(level);
      expect(nextLevelId(level.id)).toBe(index < LEVELS.length - 1 ? LEVELS[index + 1].id : null);
    });
    expect(getLevel("nao-existe")).toBeUndefined();
    expect(nextLevelId("nao-existe")).toBeNull();
  });

  describe.each(LEVELS.map((level) => [level.id, level] as const))("%s", (_id, level) => {
    const route = new RoutePath(level.waypoints);
    const minY = HUD_TOP + 40;
    const maxY = GAME_HEIGHT - HUD_BOTTOM - 40;

    it("starts and ends off-screen so enemies enter and leave the playfield", () => {
      const first = level.waypoints[0];
      const last = level.waypoints[level.waypoints.length - 1];
      const offscreen = (point: { x: number; y: number }): boolean =>
        point.x < 0 || point.x > GAME_WIDTH || point.y < HUD_TOP || point.y > GAME_HEIGHT - HUD_BOTTOM;
      expect(offscreen(first)).toBe(true);
      expect(offscreen(last)).toBe(true);
      expect(route.totalLength).toBeGreaterThan(1200);
    });

    it("keeps every platform reachable by the shrimp yet clear of the route and each other", () => {
      expect(level.placements.length).toBeGreaterThanOrEqual(4);
      expect(new Set(level.placements.map((placement) => placement.id)).size).toBe(level.placements.length);
      level.placements.forEach((placement) => {
        const distance = route.getClosestPoint(placement).distance;
        expect(distance, `${placement.id} route distance`).toBeGreaterThan(82);
        expect(distance, `${placement.id} route distance`).toBeLessThan(GUARDIANS["pistol-shrimp"].range - 10);
        expect(placement.x).toBeGreaterThan(40);
        expect(placement.x).toBeLessThan(GAME_WIDTH - 40);
        expect(placement.y).toBeGreaterThanOrEqual(minY - 12);
        expect(placement.y).toBeLessThanOrEqual(maxY);
      });
      level.placements.forEach((first, index) => {
        level.placements.slice(index + 1).forEach((second) => {
          expect(Math.hypot(first.x - second.x, first.y - second.y), `${first.id}/${second.id}`).toBeGreaterThan(90);
        });
      });
    });

    it("wraps a contiguous stretch of the route inside each current zone", () => {
      expect(level.currents.length).toBeGreaterThanOrEqual(1);
      expect(new Set(level.currents.map((current) => current.id)).size).toBe(level.currents.length);
      level.currents.forEach((current) => {
        const insideIndices = level.waypoints
          .map((point, index) => (containsPoint(current, point) ? index : -1))
          .filter((index) => index >= 0);
        expect(insideIndices.length, `${current.id} covers waypoints`).toBeGreaterThanOrEqual(2);
        insideIndices.slice(1).forEach((index, position) => {
          expect(index, `${current.id} waypoints are contiguous`).toBe(insideIndices[position] + 1);
        });
      });
    });

    it("uses only registered enemies, ends with a boss and grants a viable opening budget", () => {
      expect(level.waves.length).toBeGreaterThanOrEqual(5);
      level.waves.forEach((wave) => {
        expect(wave.groups.length).toBeGreaterThan(0);
        wave.groups.forEach((group) => {
          expect(ENEMIES[group.enemyId]).toBeDefined();
          expect(group.count).toBeGreaterThan(0);
          expect(group.intervalMs).toBeGreaterThan(0);
        });
      });
      const lastWave = level.waves[level.waves.length - 1];
      expect(lastWave.groups.some((group) => ENEMIES[group.enemyId].isBoss)).toBe(true);
      const cheapestPair = GUARDIANS["pistol-shrimp"].cost + GUARDIANS["reef-crab"].cost;
      expect(level.startingPearls).toBeGreaterThanOrEqual(cheapestPair);
      // Fases avançadas abrem com mais pérolas — a curva de chefe da V2 (300→1300) cobra isso —
      // mas nunca com um exército pronto: 425 compra quatro unidades, não um tabuleiro.
      expect(level.startingPearls).toBeLessThanOrEqual(cheapestPair * 2.5);
      expect(level.reefHealth).toBeGreaterThan(ENEMIES.tidebreaker.reefDamage);
    });
  });

  it("introduces enemy types progressively across the campaign", () => {
    expect(firstLevelWithEnemy("swimmer")).toBe(0);
    expect(firstLevelWithEnemy("dartfish")).toBe(0);
    expect(firstLevelWithEnemy("tidebreaker")).toBe(0);
    expect(firstLevelWithEnemy("minnow")).toBe(1);
    expect(firstLevelWithEnemy("shellback")).toBe(1);
    expect(firstLevelWithEnemy("needlefish")).toBe(2);
    expect(firstLevelWithEnemy("moray")).toBe(2);
    expect(firstLevelWithEnemy("corruptedShark")).toBe(4);
    // Camuflagem entra na Fase 4 e cresce daí: nunca antes de o jogador ter vocabulário para lidar.
    expect(firstLevelWithEnemy("ghostJelly")).toBe(3);
    const typesPerLevel = LEVELS.map((level) => new Set(level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId))).size);
    typesPerLevel.slice(1).forEach((count, index) => expect(count).toBeGreaterThanOrEqual(typesPerLevel[index]));
  });

  it("ramps the first level gently: four enemies in wave one, then growing", () => {
    const counts = LEVELS[0].waves.map((wave) => wave.groups.reduce((sum, group) => sum + group.count, 0));
    expect(counts[0]).toBe(4);
    counts.slice(1, -1).forEach((count, index) => expect(count).toBeGreaterThan(counts[index]));
  });

  it("raises difficulty through composition and scaling, not only counts", () => {
    const threats = LEVELS.map(threatOf);
    threats.slice(1).forEach((threat, index) => expect(threat).toBeGreaterThan(threats[index]));
    LEVELS.slice(1).forEach((level, index) => {
      expect(level.enemyScaling.health).toBeGreaterThanOrEqual(LEVELS[index].enemyScaling.health);
      expect(level.waves.length).toBeGreaterThanOrEqual(LEVELS[index].waves.length);
    });
    const mixedWaves = LEVELS.map((level) => level.waves.filter((wave) => new Set(wave.groups.map((group) => group.enemyId)).size >= 2).length);
    expect(mixedWaves[LEVELS.length - 1]).toBeGreaterThan(mixedWaves[0]);
  });
});
