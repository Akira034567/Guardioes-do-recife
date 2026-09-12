import { describe, expect, it } from "vitest";
import { challengeRule, currentChallenges, dayKey, rollChallenge, weekKey } from "../src/game/core/progression/challenges";
import { DIFFICULTY_IDS } from "../src/game/data/difficulty";
import { GUARDIAN_ORDER, LOADOUT_SIZE } from "../src/game/data/guardians";
import { LEVEL_IDS } from "../src/game/data/levels";
import { DEFAULT_UNLOCKED_GUARDIANS } from "../src/game/data/unlocks";

describe("challenges", () => {
  it("nomeia o dia e a semana em chaves estáveis", () => {
    expect(dayKey(new Date(2026, 8, 12))).toBe("2026-09-12");
    // Semana ISO: sábado e a segunda anterior caem na mesma semana.
    expect(weekKey(new Date(2026, 8, 12))).toBe(weekKey(new Date(2026, 8, 7)));
    expect(weekKey(new Date(2026, 8, 12))).not.toBe(weekKey(new Date(2026, 8, 14)));
  });

  it("sorteia o mesmo desafio para a mesma data, sem rede", () => {
    const first = rollChallenge("daily", "2026-09-12", DEFAULT_UNLOCKED_GUARDIANS);
    const again = rollChallenge("daily", "2026-09-12", DEFAULT_UNLOCKED_GUARDIANS);
    expect(again).toEqual(first);
    const other = rollChallenge("daily", "2026-09-13", DEFAULT_UNLOCKED_GUARDIANS);
    expect(other.id).not.toBe(first.id);
  });

  it("monta um desafio jogável: fase real, dificuldade válida e esquadrão completo", () => {
    for (const rotation of ["2026-09-12", "2026-01-01", "2025-12-31"]) {
      for (const kind of ["daily", "weekly"] as const) {
        const challenge = rollChallenge(kind, rotation, GUARDIAN_ORDER);
        expect(LEVEL_IDS, `${kind} ${rotation}`).toContain(challenge.levelId);
        expect(DIFFICULTY_IDS).toContain(challenge.difficulty);
        expect(challenge.loadout).toHaveLength(LOADOUT_SIZE);
        expect(new Set(challenge.loadout).size, "sem Guardião repetido").toBe(LOADOUT_SIZE);
        expect(challenge.shells).toBeGreaterThan(0);
        expect(challengeRule(challenge).length).toBeGreaterThan(5);
      }
    }
  });

  it("só propõe fases que o jogador já alcançou", () => {
    const abertas = LEVEL_IDS.slice(0, 2);
    for (const kind of ["daily", "weekly"] as const) {
      const challenge = rollChallenge(kind, "2026-09-12", GUARDIAN_ORDER, abertas);
      expect(abertas, `${kind} respeita o progresso`).toContain(challenge.levelId);
    }
    // Com uma fase só aberta, é essa que sai nos dois.
    expect(rollChallenge("daily", "2026-09-12", GUARDIAN_ORDER, [LEVEL_IDS[0]]).levelId).toBe(LEVEL_IDS[0]);
  });

  it("só escala Guardiões que o jogador já encontrou", () => {
    const challenge = rollChallenge("weekly", "2026-09-07", DEFAULT_UNLOCKED_GUARDIANS);
    challenge.loadout.forEach((guardianId) => expect(DEFAULT_UNLOCKED_GUARDIANS).toContain(guardianId));
  });

  it("o desafio da semana é mais duro que o do dia", () => {
    const weekly = rollChallenge("weekly", "2026-W37", GUARDIAN_ORDER);
    const daily = rollChallenge("daily", "2026-09-12", GUARDIAN_ORDER);
    expect(weekly.difficulty).not.toBe("normal");
    expect(weekly.shells).toBeGreaterThan(daily.shells);
  });

  it("entrega os dois desafios abertos agora", () => {
    const challenges = currentChallenges(new Date(2026, 8, 12), GUARDIAN_ORDER);
    expect(challenges.map((challenge) => challenge.kind)).toEqual(["daily", "weekly"]);
    expect(challenges[0].id).toContain("2026-09-12");
  });
});
