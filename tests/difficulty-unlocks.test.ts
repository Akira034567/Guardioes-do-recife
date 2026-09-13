import { describe, expect, it } from "vitest";
import { clampDifficulty, difficultyGates, highestUnlockedDifficulty, isDifficultyUnlocked } from "../src/game/core/progression/difficultyUnlocks";
import { createDefaultProgress } from "../src/game/core/save/PlayerProgress";
import type { PlayerProgress } from "../src/game/core/save/PlayerProgress";

const LEVEL_IDS = ["recife-1", "recife-2", "recife-3"];

const registry = {
  levelIds: LEVEL_IDS,
  guardianIds: ["pistol-shrimp"],
  enemyIds: ["swimmer"],
  defaultUnlockedGuardians: ["pistol-shrimp"],
};

function progressWith(cleared: Record<string, string[]>): PlayerProgress {
  const progress = createDefaultProgress(registry, new Date("2026-09-13"));
  for (const [levelId, difficulties] of Object.entries(cleared)) {
    progress.levelStars[levelId] = { stars: 1, objectives: [true], completions: 1, best: null, clearedDifficulties: difficulties };
  }
  return progress;
}

describe("desbloqueio de dificuldade", () => {
  it("começa só com o Normal", () => {
    const gates = difficultyGates(progressWith({}), LEVEL_IDS);
    expect(gates.map((gate) => [gate.id, gate.unlocked])).toEqual([
      ["normal", true],
      ["dificil", false],
      ["abissal", false],
    ]);
  });

  it("não abre o Difícil com a campanha pela metade", () => {
    // É desbloqueio GLOBAL: fase individual concluída não libera nada.
    const progress = progressWith({ "recife-1": ["normal"], "recife-2": ["normal"] });
    expect(isDifficultyUnlocked(progress, LEVEL_IDS, "dificil")).toBe(false);
    expect(difficultyGates(progress, LEVEL_IDS)[1].progress).toEqual({ current: 2, target: 3 });
  });

  it("abre o Difícil com a campanha inteira no Normal", () => {
    const progress = progressWith({ "recife-1": ["normal"], "recife-2": ["normal"], "recife-3": ["normal"] });
    expect(isDifficultyUnlocked(progress, LEVEL_IDS, "dificil")).toBe(true);
    expect(isDifficultyUnlocked(progress, LEVEL_IDS, "abissal")).toBe(false);
    expect(highestUnlockedDifficulty(progress, LEVEL_IDS)).toBe("dificil");
  });

  it("abre o Abissal com a campanha inteira no Difícil", () => {
    const progress = progressWith({ "recife-1": ["dificil"], "recife-2": ["dificil"], "recife-3": ["dificil"] });
    expect(highestUnlockedDifficulty(progress, LEVEL_IDS)).toBe("abissal");
  });

  it("conta por posto: vencer no Abissal satisfaz os requisitos abaixo", () => {
    // Quem sobe direto não precisa voltar e repetir a campanha nas dificuldades menores.
    const progress = progressWith({ "recife-1": ["abissal"], "recife-2": ["abissal"], "recife-3": ["abissal"] });
    expect(isDifficultyUnlocked(progress, LEVEL_IDS, "dificil")).toBe(true);
    expect(isDifficultyUnlocked(progress, LEVEL_IDS, "abissal")).toBe(true);
  });

  it("rebaixa para o Normal o que ainda não foi conquistado", () => {
    const novo = progressWith({});
    expect(clampDifficulty("abissal", novo, LEVEL_IDS)).toBe("normal");
    expect(clampDifficulty("normal", novo, LEVEL_IDS)).toBe("normal");
    expect(clampDifficulty("lixo", novo, LEVEL_IDS)).toBe("normal");
    const veterano = progressWith({ "recife-1": ["normal"], "recife-2": ["normal"], "recife-3": ["normal"] });
    expect(clampDifficulty("dificil", veterano, LEVEL_IDS)).toBe("dificil");
  });

  it("descreve o requisito que falta", () => {
    const gates = difficultyGates(progressWith({ "recife-1": ["normal"] }), LEVEL_IDS);
    expect(gates[1].requirement).toBe("Conclua as 3 fases no Normal (1/3).");
    expect(gates[2].requirement).toBe("Conclua as 3 fases no Difícil (0/3).");
  });
});
