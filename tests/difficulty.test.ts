import { describe, expect, it } from "vitest";
import { simulateLevel } from "../src/game/core/Simulation";
import { normalizeWaves } from "../src/game/core/WaveDefinitions";
import { DIFFICULTIES, DIFFICULTY_IDS, difficultyOf, resolveLevelForDifficulty } from "../src/game/data/difficulty";
import { ENEMIES } from "../src/game/data/enemies";
import { eliteAllowedFor } from "../src/game/data/elites";
import { LEVELS } from "../src/game/data/levels";
import { BALANCE_BUILDS } from "./balance-builds";

describe("difficulty", () => {
  it("leaves every level untouched on NORMAL", () => {
    for (const level of LEVELS) {
      expect(resolveLevelForDifficulty(level, DIFFICULTIES.normal), level.id).toBe(level);
    }
  });

  it("never mutates the source level", () => {
    const level = LEVELS[0];
    const before = JSON.stringify(level);
    resolveLevelForDifficulty(level, DIFFICULTIES.abissal);
    expect(JSON.stringify(level)).toBe(before);
  });

  it("scales health, speed, reward, starting pearls and reef lives", () => {
    const level = LEVELS[0];
    const hard = resolveLevelForDifficulty(level, DIFFICULTIES.dificil);
    expect(hard.enemyScaling.health).toBeCloseTo(level.enemyScaling.health * DIFFICULTIES.dificil.enemyHealth);
    expect(hard.enemyScaling.speed).toBeCloseTo(level.enemyScaling.speed * DIFFICULTIES.dificil.enemySpeed);
    expect(hard.enemyScaling.reward).toBeCloseTo(level.enemyScaling.reward * DIFFICULTIES.dificil.pearlReward);
    expect(hard.startingPearls).toBe(Math.round(level.startingPearls * DIFFICULTIES.dificil.startingPearls));
    expect(hard.reefHealth, "difícil não mexe nas vidas").toBe(level.reefHealth);
    const abyss = resolveLevelForDifficulty(level, DIFFICULTIES.abissal);
    expect(abyss.reefHealth).toBe(Math.round(level.reefHealth * (DIFFICULTIES.abissal.reefHealth ?? 1)));
  });

  it("adds enemies to every group but never clones a boss", () => {
    for (const level of LEVELS) {
      const abyss = resolveLevelForDifficulty(level, DIFFICULTIES.abissal);
      level.waves.forEach((wave, waveIndex) => {
        wave.groups.forEach((group, groupIndex) => {
          const scaled = abyss.waves[waveIndex].groups[groupIndex];
          expect(scaled.count).toBeGreaterThanOrEqual(1);
          if (ENEMIES[group.enemyId].isBoss) expect(scaled.count, `${level.id} onda ${waveIndex}`).toBe(group.count);
          else expect(scaled.count).toBeGreaterThanOrEqual(group.count);
        });
      });
    }
  });

  it("rolls elites deterministically and only where they are allowed", () => {
    const level = LEVELS[2];
    const first = resolveLevelForDifficulty(level, DIFFICULTIES.abissal);
    const again = resolveLevelForDifficulty(level, DIFFICULTIES.abissal);
    expect(JSON.stringify(again)).toBe(JSON.stringify(first));
    const other = resolveLevelForDifficulty(level, DIFFICULTIES.abissal, "outra-semente");
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(first));

    let elites = 0;
    for (const wave of first.waves) {
      for (const group of wave.groups) {
        if (!group.elite) continue;
        elites += 1;
        expect(eliteAllowedFor(ENEMIES[group.enemyId]), `${group.enemyId} não deveria virar elite`).toBe(true);
        expect(group.elitePicks?.length).toBe(Array.isArray(group.elite) ? group.elite.length : 1);
        expect(Math.max(...(group.elitePicks ?? [0]))).toBeLessThan(group.count);
      }
    }
    expect(elites, "no Abissal alguma onda precisa trazer elites").toBeGreaterThan(0);
  });

  it("keeps every resolved wave consumable by the scheduler", () => {
    for (const id of DIFFICULTY_IDS) {
      for (const level of LEVELS) {
        const resolved = resolveLevelForDifficulty(level, DIFFICULTIES[id]);
        const waves = normalizeWaves(resolved.waves);
        expect(waves).toHaveLength(level.waves.length);
        waves.forEach((wave) => wave.groups.forEach((group) => expect(group.elites).toHaveLength(group.count)));
      }
    }
  });

  it("falls back to NORMAL for unknown ids", () => {
    expect(difficultyOf("abissal").id).toBe("abissal");
    expect(difficultyOf("lenda").id).toBe("normal");
    expect(difficultyOf(null).id).toBe("normal");
  });

  it("makes a scripted build that wins on NORMAL lose ground on ABISSAL", () => {
    const build = BALANCE_BUILDS.find((candidate) => candidate.level === "recife-1");
    expect(build).toBeDefined();
    const level = LEVELS[0];
    const normal = simulateLevel(level, build?.steps ?? []);
    const abyss = simulateLevel(resolveLevelForDifficulty(level, DIFFICULTIES.abissal), build?.steps ?? []);
    expect(normal.state).toBe("victory");
    expect(abyss.reef).toBeLessThan(normal.reef);
  });
});
