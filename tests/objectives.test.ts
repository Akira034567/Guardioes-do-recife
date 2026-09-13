import { describe, expect, it } from "vitest";
import { evaluateObjectives, objectiveLabel, objectiveProgress, OBJECTIVE_PREDICATES } from "../src/game/core/progression/objectives";
import { computeLevelRewards } from "../src/game/core/progression/rewards";
import { mergeLevelRecord, starsFromObjectives, totalStars } from "../src/game/core/progression/stars";
import { REWARDS } from "../src/game/data/progression";
import { LEVELS } from "../src/game/data/levels";
import type { ObjectiveKind } from "../src/game/types";
import { makeResult } from "./helpers/matchResult";

describe("objective predicates", () => {
  const cases: Array<[ObjectiveKind, number, Parameters<typeof makeResult>[0], Parameters<typeof makeResult>[0]]> = [
    ["complete", 0, {}, { victory: false }],
    ["minLivesRemaining", 15, { livesRemaining: 15 }, { livesRemaining: 14 }],
    ["noLeaks", 0, { stats: { enemiesLeaked: 0 } }, { stats: { enemiesLeaked: 1 } }],
    ["noEliteLeaks", 0, { stats: { eliteLeaks: 0, bossLeaks: 0 } }, { stats: { eliteLeaks: 1 } }],
    ["maxGuardians", 3, { stats: { maxSimultaneousGuardians: 3 } }, { stats: { maxSimultaneousGuardians: 4 } }],
    ["maxDistinctGuardians", 2, { stats: { distinctGuardiansUsed: ["shark", "dolphin"] } }, { stats: { distinctGuardiansUsed: ["shark", "dolphin", "jellyfish"] } }],
    ["underTimeMs", 60_000, { stats: { timeMs: 60_000 } }, { stats: { timeMs: 60_001 } }],
    ["noFinalEvolution", 0, { stats: { maxUpgradeLevel: 1 } }, { stats: { maxUpgradeLevel: 2 } }],
    ["noSell", 0, { stats: { guardiansSold: 0 } }, { stats: { guardiansSold: 1 } }],
    ["noEarlyCall", 0, { stats: { earlyWaveCalls: 0 } }, { stats: { earlyWaveCalls: 1 } }],
  ];

  it.each(cases)("%s passes and fails as expected", (kind, value, passing, failing) => {
    expect(OBJECTIVE_PREDICATES[kind](makeResult(passing), value)).toBe(true);
    expect(OBJECTIVE_PREDICATES[kind](makeResult(failing), value)).toBe(false);
  });

  it("never awards a secondary objective on a defeat", () => {
    const defeat = makeResult({ victory: false, livesRemaining: 0, stats: { enemiesLeaked: 0, guardiansSold: 0 } });
    for (const [kind, value] of cases) expect(OBJECTIVE_PREDICATES[kind](defeat, value), kind).toBe(false);
  });

  it("evaluates one flag per declared objective, in order", () => {
    const definitions = LEVELS[0].objectives ?? [];
    const result = makeResult({ livesRemaining: 20, stats: { maxSimultaneousGuardians: 2 } });
    expect(evaluateObjectives(definitions, result)).toEqual([true, true, true]);
    expect(evaluateObjectives(definitions, makeResult({ livesRemaining: 3, stats: { maxSimultaneousGuardians: 9 } }))).toEqual([true, false, false]);
  });

  it("tells the HUD when an objective is already lost", () => {
    const objectives = LEVELS[0].objectives;
    if (!objectives) throw new Error("Recife 1 precisa declarar objetivos");
    const [, lives, guardians] = objectives;
    expect(objectiveProgress(lives, makeResult({ victory: false, livesRemaining: 20 }))).toBe("pending");
    expect(objectiveProgress(lives, makeResult({ victory: false, livesRemaining: 4 }))).toBe("failed");
    expect(objectiveProgress(guardians, makeResult({ victory: false, stats: { maxSimultaneousGuardians: 9 } }))).toBe("failed");
  });

  it("describes every kind in Portuguese", () => {
    for (const [kind, value] of cases) {
      const label = objectiveLabel({ id: kind, kind, value });
      expect(label.length, kind).toBeGreaterThan(8);
    }
  });
});

describe("stars", () => {
  it("counts fulfilled objectives", () => {
    expect(starsFromObjectives([])).toBe(0);
    expect(starsFromObjectives([true, false, false])).toBe(1);
    expect(starsFromObjectives([true, true, true])).toBe(3);
  });

  it("never loses a star already earned", () => {
    const first = mergeLevelRecord(undefined, makeResult({ livesRemaining: 20 }), [true, true, false]);
    expect(first.next.stars).toBe(2);
    expect(first.firstCompletion).toBe(true);
    expect(first.newStars).toBe(2);

    const worse = mergeLevelRecord(first.next, makeResult({ livesRemaining: 1 }), [true, false, false]);
    expect(worse.next.stars, "uma partida pior não tira estrelas").toBe(2);
    expect(worse.newStars).toBe(0);
    expect(worse.firstCompletion).toBe(false);
    expect(worse.next.completions).toBe(2);

    const perfect = mergeLevelRecord(worse.next, makeResult({ livesRemaining: 20 }), [true, false, true]);
    expect(perfect.next.stars).toBe(3);
    expect(perfect.newObjectives).toEqual([false, false, true]);
    expect(perfect.firstPerfect).toBe(true);
    expect(mergeLevelRecord(perfect.next, makeResult({}), [true, true, true]).firstPerfect, "3/3 só conta uma vez").toBe(false);
  });

  it("keeps only the best run and ignores defeats", () => {
    const first = mergeLevelRecord(undefined, makeResult({ stats: { livesLost: 5, timeMs: 200_000, maxSimultaneousGuardians: 6 } }), [true, false, false]);
    const better = mergeLevelRecord(first.next, makeResult({ stats: { livesLost: 2, timeMs: 300_000, maxSimultaneousGuardians: 4 } }), [true, false, false]);
    expect(better.next.best).toEqual({ livesLost: 2, durationMs: 200_000, guardiansUsed: 4, difficulty: "normal" });

    const defeat = mergeLevelRecord(better.next, makeResult({ victory: false }), [false, false, false]);
    expect(defeat.next).toEqual(better.next);
    expect(defeat.newStars).toBe(0);
  });

  it("adds up the stars of every level", () => {
    expect(totalStars({ "recife-1": { stars: 3, objectives: [], completions: 1, best: null, clearedDifficulties: [] }, "recife-2": { stars: 2, objectives: [], completions: 1, best: null, clearedDifficulties: [] } })).toBe(5);
  });
});

describe("rewards", () => {
  it("pays the first completion plus every new star", () => {
    const merge = mergeLevelRecord(undefined, makeResult({}), [true, true, false]);
    const reward = computeLevelRewards(merge, "normal");
    expect(reward.shells).toBe(REWARDS.firstCompletion + REWARDS.perNewStar * 2);
    expect(reward.lines.map((line) => line.label)).toEqual(["Primeira conclusão", "2 estrelas novas"]);
  });

  it("pays the perfect bonus once and a small amount for a plain replay", () => {
    const first = mergeLevelRecord(undefined, makeResult({}), [true, true, true]);
    expect(computeLevelRewards(first, "normal").shells).toBe(REWARDS.firstCompletion + REWARDS.perNewStar * 3 + REWARDS.firstPerfect);
    const again = mergeLevelRecord(first.next, makeResult({}), [true, true, true]);
    expect(computeLevelRewards(again, "normal")).toEqual({ shells: REWARDS.replayVictory, lines: [{ label: "Recife defendido de novo", shells: REWARDS.replayVictory }] });
  });

  it("multiplies the whole reward by the difficulty", () => {
    const merge = mergeLevelRecord(undefined, makeResult({}), [true, false, false]);
    const normal = computeLevelRewards(merge, "normal").shells;
    expect(computeLevelRewards(merge, "abissal").shells).toBeGreaterThan(normal);
    expect(computeLevelRewards(merge, "desconhecida").shells).toBe(normal);
  });
});

describe("level objective data", () => {
  it("gives every level three objectives, starting with completing it", () => {
    for (const level of LEVELS) {
      const objectives = level.objectives;
      expect(objectives, level.id).toBeDefined();
      expect(objectives).toHaveLength(3);
      expect(objectives?.[0].kind, level.id).toBe("complete");
      expect(new Set(objectives?.map((objective) => objective.id)).size, `${level.id}: ids repetidos`).toBe(3);
      objectives?.slice(1).forEach((objective) => {
        expect(objective.kind, `${level.id}: o objetivo 2 e 3 não podem ser "complete"`).not.toBe("complete");
        if (["minLivesRemaining", "maxGuardians", "maxDistinctGuardians", "underTimeMs"].includes(objective.kind)) {
          expect(objective.value, `${level.id}/${objective.id} precisa de um número`).toBeGreaterThan(0);
        }
      });
    }
  });

  it("asks for fewer lives than the level has", () => {
    for (const level of LEVELS) {
      const lives = level.objectives?.find((objective) => objective.kind === "minLivesRemaining");
      if (lives) expect(lives.value, level.id).toBeLessThanOrEqual(level.reefHealth);
    }
  });
});
