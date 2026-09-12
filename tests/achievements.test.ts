import { describe, expect, it } from "vitest";
import { achievementShells, achievementStatuses, applyAchievements, measureAchievement } from "../src/game/core/progression/achievements";
import { ACHIEVEMENTS, achievement } from "../src/game/data/achievements";
import { createDefaultProgress } from "../src/game/core/save/PlayerProgress";
import { ENEMY_ORDER } from "../src/game/data/enemies";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";
import { LEVEL_IDS } from "../src/game/data/levels";
import { DEFAULT_UNLOCKED_GUARDIANS } from "../src/game/data/unlocks";
import { makeResult } from "./helpers/matchResult";

const registry = { levelIds: LEVEL_IDS, guardianIds: GUARDIAN_ORDER, enemyIds: ENEMY_ORDER, defaultUnlockedGuardians: DEFAULT_UNLOCKED_GUARDIANS };
const progress = () => createDefaultProgress(registry, new Date("2026-01-01T00:00:00.000Z"));

describe("achievements", () => {
  it("tem ids únicos, metas positivas e recompensa em Conchas", () => {
    const ids = ACHIEVEMENTS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const definition of ACHIEVEMENTS) {
      expect(definition.target, definition.id).toBeGreaterThan(0);
      expect(definition.shells, definition.id).toBeGreaterThan(0);
      expect(definition.description.length, definition.id).toBeGreaterThan(10);
    }
    expect(achievement("primeira-mare")).toBeDefined();
    expect(achievement("nao-existe")).toBeUndefined();
  });

  it("mede os totais do perfil", () => {
    const draft = progress();
    draft.totals.kills = 320;
    draft.totals.playTimeMs = 75 * 60_000;
    draft.completedLevels = ["recife-1", "recife-2"];
    draft.discoveredSecrets = ["pedra-que-pisca"];
    expect(measureAchievement(achievement("faxina")!, draft)).toBe(320);
    expect(measureAchievement(achievement("veterano")!, draft)).toBe(75);
    expect(measureAchievement(achievement("recife-protegido")!, draft)).toBe(2);
    expect(measureAchievement(achievement("olho-de-peixe")!, draft)).toBe(1);
  });

  it("guarda a melhor marca de uma partida e nunca piora", () => {
    const draft = progress();
    applyAchievements(draft, makeResult({ stats: { enemiesKilled: 40 } }));
    expect(draft.achievements.banquete.progress).toBe(40);
    // Uma partida fraca depois não derruba o recorde.
    applyAchievements(draft, makeResult({ stats: { enemiesKilled: 5 } }));
    expect(draft.achievements.banquete.progress).toBe(40);
    applyAchievements(draft, makeResult({ stats: { enemiesKilled: 61 } }));
    expect(draft.achievements.banquete.unlockedAt).not.toBeNull();
  });

  it("conta as partidas que cumpriram uma condição", () => {
    const draft = progress();
    // Derrota não conta, mesmo sem vazamento.
    applyAchievements(draft, makeResult({ victory: false, stats: { enemiesLeaked: 0 } }));
    expect(draft.achievements.muralha.progress).toBe(0);
    const unlocked = applyAchievements(draft, makeResult({ victory: true, stats: { enemiesLeaked: 0 } }));
    expect(unlocked.map((definition) => definition.id)).toContain("muralha");
    expect(draft.achievements.muralha.unlockedAt).not.toBeNull();
  });

  it("reconhece a vitória com uma espécie só e a vitória no abissal", () => {
    const draft = progress();
    const unlocked = applyAchievements(draft, makeResult({ difficulty: "abissal", stats: { distinctGuardiansUsed: ["pistol-shrimp"] } }));
    const ids = unlocked.map((definition) => definition.id);
    expect(ids).toContain("fundo-do-poco");
    expect(ids).toContain("sozinho-no-escuro");
  });

  it("entrega cada conquista uma vez só", () => {
    const draft = progress();
    // Na partida real os totais do perfil são somados antes; aqui fazemos o mesmo.
    draft.totals.victories = 1;
    const first = applyAchievements(draft, makeResult({ victory: true }));
    const again = applyAchievements(draft, makeResult({ victory: true }));
    expect(first.map((definition) => definition.id)).toContain("primeira-mare");
    expect(again.map((definition) => definition.id)).not.toContain("primeira-mare");
    expect(achievementShells(first)).toBeGreaterThan(0);
  });

  it("lista o progresso de tudo para a tela de conquistas", () => {
    const draft = progress();
    draft.totals.kills = 250;
    applyAchievements(draft);
    const statuses = achievementStatuses(draft, ["faxina"]);
    expect(statuses).toHaveLength(ACHIEVEMENTS.length);
    const faxina = statuses.find((status) => status.definition.id === "faxina");
    expect(faxina).toMatchObject({ progress: 250, target: 500, unlocked: false, isNew: true });
    // O progresso mostrado nunca passa da meta.
    draft.totals.kills = 900;
    applyAchievements(draft);
    expect(achievementStatuses(draft).find((status) => status.definition.id === "faxina")?.progress).toBe(500);
  });
});
