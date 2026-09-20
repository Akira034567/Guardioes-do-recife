import { describe, expect, it } from "vitest";
import { hasOwnObjectives, objectivesFor } from "../src/game/core/progression/levelObjectives";
import { difficultyTrack, mergeLevelRecord } from "../src/game/core/progression/stars";
import { DIFFICULTIES, DIFFICULTY_IDS, resolveLevelForDifficulty } from "../src/game/data/difficulty";
import { LEVELS } from "../src/game/data/levels";
import { makeResult } from "./helpers/matchResult";

describe("objetivos por dificuldade", () => {
  it("dá a toda fase um trio próprio no Difícil e no Abissal", () => {
    for (const level of LEVELS) {
      for (const difficulty of ["dificil", "abissal"] as const) {
        const trio = objectivesFor(level, difficulty);
        expect(trio, `${level.id}/${difficulty}`).toHaveLength(3);
        expect(trio[0].kind, `${level.id}/${difficulty}`).toBe("complete");
        expect(new Set(trio.map((objective) => objective.id)).size, `${level.id}/${difficulty}: ids repetidos`).toBe(3);
        expect(hasOwnObjectives(level, difficulty), level.id).toBe(true);
      }
    }
  });

  it("nunca pede mais vidas do que a dificuldade deixa o Recife ter", () => {
    for (const level of LEVELS) {
      for (const difficulty of DIFFICULTY_IDS) {
        const resolved = resolveLevelForDifficulty(level, DIFFICULTIES[difficulty]);
        const lives = objectivesFor(level, difficulty).find((objective) => objective.kind === "minLivesRemaining");
        if (lives) expect(lives.value ?? 0, `${level.id}/${difficulty}`).toBeLessThanOrEqual(resolved.reefHealth);
      }
    }
  });

  it("dificuldade desconhecida cai no trio do Normal", () => {
    expect(objectivesFor(LEVELS[0], "lunar")).toEqual(LEVELS[0].objectives);
  });
});

describe("trilhas de estrela por dificuldade", () => {
  it("guarda as estrelas do Difícil sem mexer nas do Normal", () => {
    const normal = mergeLevelRecord(undefined, makeResult({ difficulty: "normal" }), [true, true, false]);
    expect(normal.next.stars).toBe(2);

    const hard = mergeLevelRecord(normal.next, makeResult({ difficulty: "dificil" }), [true, false, false], {
      normalObjectives: [true, false, false],
    });
    expect(hard.playedStars, "a trilha do Difícil começa do zero").toBe(1);
    expect(hard.next.stars, "as estrelas do Normal não regridem").toBe(2);
    expect(difficultyTrack(hard.next, "dificil").stars).toBe(1);
    expect(difficultyTrack(hard.next, "normal").stars).toBe(2);
    expect(hard.next.clearedDifficulties).toContain("dificil");
  });

  it("uma corrida no Difícil que cumpre a missão do Normal também marca lá", () => {
    const hard = mergeLevelRecord(undefined, makeResult({ difficulty: "dificil" }), [true, false, false], {
      normalObjectives: [true, true, true],
    });
    expect(hard.next.stars).toBe(3);
    expect(hard.playedStars).toBe(1);
  });

  it("uma fase sem trilha nenhuma responde pela trilha do Normal", () => {
    expect(difficultyTrack(undefined, "normal")).toEqual({ stars: 0, objectives: [], completions: 0 });
    expect(difficultyTrack({ stars: 3, objectives: [true, true, true], completions: 2, best: null, clearedDifficulties: [] }, "normal")).toEqual({
      stars: 3,
      objectives: [true, true, true],
      completions: 2,
    });
  });
});
