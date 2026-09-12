import { describe, expect, it } from "vitest";
import { ProgressionService } from "../src/game/core/progression/ProgressionService";
import { SaveManager, type SaveStorage } from "../src/game/core/save/SaveManager";
import { REWARDS } from "../src/game/data/progression";
import { DEFAULT_UNLOCKED_GUARDIANS, GUARDIAN_UNLOCKS, type GuardianUnlockDefinition } from "../src/game/data/unlocks";
import { LEVELS, LEVEL_IDS } from "../src/game/data/levels";
import { ENEMY_ORDER } from "../src/game/data/enemies";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";
import type { LevelObjectiveDefinition } from "../src/game/types";
import { makeResult } from "./helpers/matchResult";

const registry = {
  levelIds: LEVEL_IDS,
  guardianIds: GUARDIAN_ORDER,
  enemyIds: ENEMY_ORDER,
  defaultUnlockedGuardians: DEFAULT_UNLOCKED_GUARDIANS,
};

const OBJECTIVES = LEVELS[0].objectives as [LevelObjectiveDefinition, LevelObjectiveDefinition, LevelObjectiveDefinition];

function memoryStorage(): SaveStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

function service(unlocks: readonly GuardianUnlockDefinition[] = GUARDIAN_UNLOCKS) {
  const save = new SaveManager(memoryStorage(), { registry });
  return { save, progression: new ProgressionService(save, { levelIds: LEVEL_IDS, unlocks }) };
}

describe("ProgressionService", () => {
  it("records stars, shells and the next level on a first victory", () => {
    const { progression, save } = service();
    const outcome = progression.applyMatchResult(makeResult({ livesRemaining: 20, stats: { maxSimultaneousGuardians: 2 } }), OBJECTIVES);
    expect(outcome.stars).toBe(3);
    expect(outcome.starsBefore).toBe(0);
    expect(outcome.objectives.map((objective) => objective.achieved)).toEqual([true, true, true]);
    expect(outcome.objectives.every((objective) => objective.isNew)).toBe(true);
    expect(outcome.rewards.shells).toBe(REWARDS.firstCompletion + REWARDS.perNewStar * 3 + REWARDS.firstPerfect);
    expect(outcome.nextLevelId).toBe("recife-2");
    expect(save.progress.currency.shells).toBe(outcome.rewards.shells);
    expect(save.progress.currency.lifetimeShells).toBe(outcome.rewards.shells);
    expect(save.progress.completedLevels).toEqual(["recife-1"]);
    expect(save.progress.levelStars["recife-1"]).toMatchObject({ stars: 3, completions: 1 });
  });

  it("keeps stars and pays little on a weaker replay", () => {
    const { progression, save } = service();
    progression.applyMatchResult(makeResult({ livesRemaining: 20, stats: { maxSimultaneousGuardians: 2 } }), OBJECTIVES);
    const shells = save.progress.currency.shells;
    const again = progression.applyMatchResult(makeResult({ livesRemaining: 2, stats: { maxSimultaneousGuardians: 9 } }), OBJECTIVES);
    expect(again.stars, "estrela conquistada não volta atrás").toBe(3);
    expect(again.objectives.every((objective) => !objective.isNew)).toBe(true);
    expect(again.rewards.shells).toBe(REWARDS.replayVictory);
    expect(save.progress.currency.shells).toBe(shells + REWARDS.replayVictory);
    expect(save.progress.levelStars["recife-1"].completions).toBe(2);
  });

  it("saves nothing but the bestiary on a defeat", () => {
    const { progression, save } = service();
    const outcome = progression.applyMatchResult(makeResult({ victory: false, livesRemaining: 0, stats: { kills: { swimmer: 3 } } }), OBJECTIVES);
    expect(outcome.stars).toBe(0);
    expect(outcome.nextLevelId).toBeNull();
    expect(save.progress.completedLevels).toEqual([]);
    expect(save.progress.currency.shells).toBe(0);
    expect(save.progress.enemyDiscovery.swimmer).toMatchObject({ kills: 3, firstSeenLevelId: "recife-1" });
    expect(save.progress.totals.defeats).toBe(1);
  });

  it("ignores a match played with debug commands, except for discoveries", () => {
    const { progression, save } = service();
    const outcome = progression.applyMatchResult(makeResult({ stats: { cheated: true, kills: { moray: 2 } } }), OBJECTIVES);
    expect(outcome.counted).toBe(false);
    expect(outcome.rewards.shells).toBe(0);
    expect(save.progress.completedLevels, "partida testada não conclui fase").toEqual([]);
    expect(save.progress.currency.shells).toBe(0);
    expect(save.progress.totals.matches).toBe(0);
    expect(save.progress.enemyDiscovery.moray?.kills).toBe(2);
  });

  it("counts enemies seen and leaked, adding up across matches", () => {
    const { progression, save } = service();
    progression.applyMatchResult(makeResult({ stats: { kills: { swimmer: 4 }, leaks: { dartfish: 1 } } }), OBJECTIVES);
    progression.applyMatchResult(makeResult({ stats: { kills: { swimmer: 6 } } }), OBJECTIVES);
    expect(save.progress.enemyDiscovery.swimmer.kills).toBe(10);
    expect(save.progress.enemyDiscovery.dartfish, "vazou é o bastante para entrar no bestiário").toMatchObject({ kills: 0 });
  });

  it("tracks the career of each guardian used", () => {
    const { progression, save } = service();
    progression.applyMatchResult(
      makeResult({
        stats: {
          distinctGuardiansUsed: ["pistol-shrimp", "jellyfish"],
          killsByGuardianType: { "pistol-shrimp": 20, jellyfish: 5 },
          damageByGuardianType: { "pistol-shrimp": 900.4 },
          placementsByGuardian: { "pistol-shrimp": 2, jellyfish: 1 },
          upgradesBought: 3,
        },
      }),
      OBJECTIVES,
    );
    expect(save.progress.guardianStats["pistol-shrimp"]).toMatchObject({ matches: 1, kills: 20, damage: 900, placements: 2, upgrades: 3 });
    expect(save.progress.guardianStats.jellyfish).toMatchObject({ matches: 1, kills: 5, placements: 1 });
    expect(save.progress.guardianStats.pufferfish).toBeUndefined();
  });

  it("remembers the squad unless it came from the URL", () => {
    const { progression, save } = service();
    progression.applyMatchResult(makeResult({ loadout: ["shark", "dolphin", "jellyfish", "pufferfish", "reef-crab"] }), OBJECTIVES);
    expect(save.progress.lastLoadout).toEqual(["shark", "dolphin", "jellyfish", "pufferfish", "reef-crab"]);
    progression.applyMatchResult(makeResult({ loadout: ["stonefish", "shark", "dolphin", "sea-turtle", "reef-crab"], loadoutOverride: true }), OBJECTIVES);
    expect(save.progress.lastLoadout, "?guardians= não muda o esquadrão salvo").toEqual(["shark", "dolphin", "jellyfish", "pufferfish", "reef-crab"]);
  });
});

describe("guardian unlocks", () => {
  it("starts with the five founders and nothing else", () => {
    const { progression } = service();
    expect(progression.progress.unlockedGuardians.sort()).toEqual([...DEFAULT_UNLOCKED_GUARDIANS].sort());
    expect(progression.isUnlocked("shark")).toBe(false);
  });

  it("covers every guardian in the catalogue exactly once", () => {
    expect(GUARDIAN_UNLOCKS.map((definition) => definition.guardianId).sort()).toEqual([...GUARDIAN_ORDER].sort());
    for (const definition of GUARDIAN_UNLOCKS) {
      expect(definition.conditions.length, definition.guardianId).toBeGreaterThan(0);
      expect(definition.reveal.hint.length, definition.guardianId).toBeGreaterThan(10);
    }
  });

  it("unlocks a guardian when its encounter is completed", () => {
    const { progression, save } = service();
    save.update((draft) => draft.completedEncounters.push("gruta-do-predador"));
    expect(progression.reconcile()).toEqual(["shark"]);
    expect(progression.isUnlocked("shark")).toBe(true);
    expect(progression.reconcile(), "reconciliar de novo não repete").toEqual([]);
  });

  it("unlocks the guardian by finishing his encounter, and queues the reveal", () => {
    const { progression, save } = service();
    // Vencer a fase da campanha não entrega mais o Tubarão: ele vem do Encontro.
    progression.applyMatchResult(makeResult({ levelId: "recife-2" }), OBJECTIVES);
    expect(progression.isUnlocked("shark")).toBe(false);

    progression.applyMatchResult(makeResult({ levelId: "gruta-do-predador", kind: "encounter", encounterId: "gruta-do-predador" }), []);
    expect(progression.isUnlocked("shark")).toBe(true);
    expect(save.progress.completedEncounters).toEqual(["gruta-do-predador"]);
    // Encontro não entra na cadeia de fases nem vale estrela.
    expect(save.progress.completedLevels).toEqual(["recife-2"]);
    expect(save.progress.levelStars["gruta-do-predador"]).toBeUndefined();
    expect(progression.takePendingReveals()).toEqual(["shark"]);
    expect(progression.takePendingReveals(), "a fila esvazia depois de apresentada").toEqual([]);
  });

  it("reports progress and hidden cards for what is still locked", () => {
    const { progression, save } = service();
    const before = progression.unlockStatuses();
    expect(before.find((status) => status.guardianId === "pistol-shrimp")?.state).toBe("unlocked");
    expect(before.find((status) => status.guardianId === "stonefish")).toMatchObject({ state: "locked", hidden: true });
    // Achar o segredo tira o "???" sem entregar o Guardião: ele ainda depende do Encontro.
    save.update((draft) => draft.discoveredSecrets.push("pedra-que-pisca"));
    const after = progression.unlockStatuses().find((status) => status.guardianId === "stonefish");
    expect(after?.hidden, "com a pista, o card sai do ???").toBe(false);
    expect(after?.state).toBe("locked");
    expect(progression.isUnlocked("stonefish")).toBe(false);
  });

  it("buys a guardian with shells and refuses when short", () => {
    const buyable: GuardianUnlockDefinition[] = [
      { guardianId: "shark", conditions: [{ type: "purchase", shells: 150 }], reveal: { title: "t", role: "r", mechanic: "m", hint: "uma pista longa" } },
    ];
    const { progression, save } = service(buyable);
    expect(progression.buy("shark")).toEqual({ ok: false, reason: "insufficientShells" });
    save.update((draft) => (draft.currency.shells = 200));
    expect(progression.unlockStatuses()[0].state).toBe("available");
    expect(progression.buy("shark")).toEqual({ ok: true });
    expect(save.progress.currency.shells).toBe(50);
    expect(save.progress.pendingUnlockReveals).toEqual(["shark"]);
    expect(progression.buy("shark")).toEqual({ ok: false, reason: "alreadyUnlocked" });
    expect(progression.buy("dolphin")).toEqual({ ok: false, reason: "notFound" });
  });

  it("never unlocks a purchasable guardian for free", () => {
    const buyable: GuardianUnlockDefinition[] = [
      { guardianId: "shark", conditions: [{ type: "purchase", shells: 10 }], reveal: { title: "t", role: "r", mechanic: "m", hint: "uma pista longa" } },
    ];
    const { progression, save } = service(buyable);
    save.update((draft) => (draft.currency.shells = 999));
    expect(progression.reconcile()).toEqual([]);
    expect(progression.isUnlocked("shark")).toBe(false);
  });
});
