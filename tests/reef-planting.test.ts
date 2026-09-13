import { describe, expect, it } from "vitest";
import { reconcileReef } from "../src/game/core/reef/planting";
import { removeDecoration } from "../src/game/core/reef/economy";
import { reefGrowth } from "../src/game/core/reef/growth";
import { decoration, DECORATIONS } from "../src/game/data/reef/decorations";
import { REEF_SLOTS } from "../src/game/data/reef/layout";
import { createDefaultProgress, MAX_PLACED_DECORATIONS, type PlayerProgress, type Stars } from "../src/game/core/save/PlayerProgress";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";
import { LEVEL_IDS } from "../src/game/data/levels";

const registry = {
  levelIds: LEVEL_IDS,
  guardianIds: GUARDIAN_ORDER,
  enemyIds: [],
  defaultUnlockedGuardians: ["pistol-shrimp", "jellyfish", "pufferfish", "reef-crab", "ink-octopus"],
};

const freshProgress = (profileId = "local"): PlayerProgress => {
  const progress = createDefaultProgress(registry, new Date("2026-09-13T00:00:00Z"));
  progress.profileId = profileId;
  return progress;
};

/** Sobe a pontuação sem depender de conteúdo específico: cada capítulo lido vale um ponto. */
function withScore(progress: PlayerProgress, score: number): PlayerProgress {
  progress.storyProgress.seen = Array.from({ length: score }, (_, index) => `capitulo-${index}`);
  return progress;
}

describe("reef planting", () => {
  it("plants the starter reef and fills every open slot it can", () => {
    const progress = freshProgress();
    const result = reconcileReef(progress);
    const open = reefGrowth(progress).activeSlots;
    expect(result.planted.length).toBeGreaterThan(0);
    expect(progress.reef.placed).toHaveLength(open.length);
    // Tudo que está plantado pertence ao jogador.
    for (const item of progress.reef.placed) expect(progress.reef.owned).toContain(item.defId);
  });

  it("does nothing on a second pass", () => {
    const progress = freshProgress();
    reconcileReef(progress);
    const before = JSON.stringify(progress.reef);
    const again = reconcileReef(progress);
    expect(again.planted).toHaveLength(0);
    expect(JSON.stringify(progress.reef)).toBe(before);
  });

  it("gives the same profile the same reef every time", () => {
    const first = freshProgress("perfil-a");
    const second = freshProgress("perfil-a");
    reconcileReef(first);
    reconcileReef(second);
    expect(second.reef.placed).toEqual(first.reef.placed);

    // Outro perfil pode (e deve) receber um Recife diferente.
    const other = freshProgress("perfil-b");
    reconcileReef(other);
    const sameLayout = JSON.stringify(other.reef.placed) === JSON.stringify(first.reef.placed);
    expect(sameLayout).toBe(false);
  });

  it("only ever adds: growing the reef never moves or removes what is already there", () => {
    const progress = withScore(freshProgress(), 0);
    reconcileReef(progress);
    const before = progress.reef.placed.map((item) => ({ ...item }));

    withScore(progress, 60);
    reconcileReef(progress);

    expect(progress.reef.placed.length).toBeGreaterThan(before.length);
    // É isto que significa "gradual, não troca de cenário": o que já existia fica onde estava.
    for (const original of before) {
      const current = progress.reef.placed.find((item) => item.instanceId === original.instanceId);
      expect(current).toEqual(original);
    }
  });

  it("respects a decoration the player deliberately removed", () => {
    const progress = freshProgress();
    reconcileReef(progress);
    const victim = progress.reef.placed[0];
    expect(removeDecoration(progress, victim.instanceId)).toBe(true);

    reconcileReef(progress);
    const replanted = progress.reef.placed.some((item) => item.defId === victim.defId && item.slotId === victim.slotId);
    expect(replanted).toBe(false);
  });

  it("never breaks maxCount nor the save ceiling", () => {
    const progress = withScore(freshProgress(), 400);
    progress.completedLevels = [...LEVEL_IDS];
    progress.unlockedGuardians = [...GUARDIAN_ORDER];
    for (const levelId of LEVEL_IDS) {
      progress.levelStars[levelId] = { stars: 3 as Stars, objectives: [], completions: 1, best: null, clearedDifficulties: [] };
    }
    reconcileReef(progress);

    expect(progress.reef.placed.length).toBeLessThanOrEqual(MAX_PLACED_DECORATIONS);
    const counts = new Map<string, number>();
    for (const item of progress.reef.placed) counts.set(item.defId, (counts.get(item.defId) ?? 0) + 1);
    for (const [defId, count] of counts) {
      expect(count, `${defId} passou do limite`).toBeLessThanOrEqual(decoration(defId)!.maxCount);
    }
  });

  it("never auto-plants something the player has not paid for", () => {
    const progress = withScore(freshProgress(), 400);
    reconcileReef(progress);
    const paid = DECORATIONS.filter((definition) => definition.cost > 0).map((definition) => definition.id);
    for (const item of progress.reef.placed) expect(paid).not.toContain(item.defId);
  });

  it("anchors every planted piece to a real slot", () => {
    const progress = withScore(freshProgress(), 120);
    reconcileReef(progress);
    const slotIds = new Set(REEF_SLOTS.map((slot) => slot.id));
    for (const item of progress.reef.placed) {
      expect(item.slotId).not.toBeNull();
      expect(slotIds.has(item.slotId!)).toBe(true);
    }
    // Um canteiro nunca recebe duas peças.
    const used = progress.reef.placed.map((item) => item.slotId);
    expect(new Set(used).size).toBe(used.length);
  });
});
