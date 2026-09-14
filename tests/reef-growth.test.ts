import { describe, expect, it } from "vitest";
import { DECORATIONS, decoration } from "../src/game/data/reef/decorations";
import { REEF_LANDMARKS, REEF_SLOTS, SLOT_KINDS, slotsOfKind } from "../src/game/data/reef/layout";
import { isDecorationUnlocked, MAX_REEF_STAGE, reefGrowth, reefScore, reefStage, REEF_THRESHOLDS, SLOT_STEP } from "../src/game/core/reef/growth";
import { createDefaultProgress, type PlayerProgress, type Stars } from "../src/game/core/save/PlayerProgress";
import { ACHIEVEMENTS } from "../src/game/data/achievements";
import { ENCOUNTERS } from "../src/game/data/encounters";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";
import { LEVEL_IDS } from "../src/game/data/levels";
import { STORY_SEQUENCES } from "../src/game/data/story";

const registry = {
  levelIds: LEVEL_IDS,
  guardianIds: GUARDIAN_ORDER,
  enemyIds: [],
  defaultUnlockedGuardians: ["pistol-shrimp", "jellyfish", "pufferfish", "reef-crab", "ink-octopus"],
};

const emptyProgress = (): PlayerProgress => createDefaultProgress(registry, new Date("2026-09-13T00:00:00Z"));

/** Um save com tudo feito: serve de teto para conferir que o catálogo inteiro é alcançável. */
function completeProgress(): PlayerProgress {
  const progress = emptyProgress();
  progress.completedLevels = [...LEVEL_IDS];
  for (const levelId of LEVEL_IDS) {
    progress.levelStars[levelId] = { stars: 3 as Stars, objectives: [true, true, true], completions: 1, best: null, clearedDifficulties: [] };
  }
  progress.unlockedGuardians = [...GUARDIAN_ORDER];
  progress.completedEncounters = ENCOUNTERS.map((encounter) => encounter.id);
  progress.discoveredSecrets = ["pedra-que-pisca"];
  progress.storyProgress.seen = STORY_SEQUENCES.map((sequence) => sequence.id);
  for (const achievement of ACHIEVEMENTS) {
    progress.achievements[achievement.id] = { progress: achievement.target, unlockedAt: "2026-09-13T00:00:00.000Z", claimed: true };
  }
  return progress;
}

describe("reef growth", () => {
  it("starts an empty reef at stage 0 with only the always-open slots and landmarks", () => {
    const growth = reefGrowth(emptyProgress());
    expect(growth.stage).toBe(0);
    expect(growth.score).toBe(0);
    expect(growth.vitality).toBe(0);
    expect(growth.activeSlots).toEqual(["coral-a"]);
    // Os lugares vêm pintados no fundo: os seis existem desde a primeira visita, senão a arte
    // mostraria uma porta que não abre.
    expect(growth.activeLandmarks).toHaveLength(REEF_LANDMARKS.length);
  });

  it("never lowers the score when the player does more", () => {
    const progress = emptyProgress();
    let previous = reefScore(progress);
    const steps: Array<(draft: PlayerProgress) => void> = [
      (draft) => draft.completedLevels.push("recife-1"),
      (draft) => {
        draft.levelStars["recife-1"] = { stars: 3 as Stars, objectives: [true, true, true], completions: 1, best: null, clearedDifficulties: [] };
      },
      (draft) => draft.unlockedGuardians.push("shark"),
      (draft) => draft.completedEncounters.push("gruta-do-predador"),
      (draft) => draft.discoveredSecrets.push("pedra-que-pisca"),
      (draft) => draft.storyProgress.seen.push("abertura"),
    ];
    for (const step of steps) {
      step(progress);
      const score = reefScore(progress);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it("puts every threshold on its own stage", () => {
    REEF_THRESHOLDS.forEach((threshold, stage) => {
      const progress = emptyProgress();
      // Estrelas valem 3 pontos: é o degrau mais fino para acertar uma pontuação exata.
      progress.storyProgress.seen = Array.from({ length: threshold }, (_, index) => `capitulo-${index}`);
      expect(reefScore(progress)).toBe(threshold);
      expect(reefStage(progress)).toBe(stage);
      if (threshold > 0) {
        progress.storyProgress.seen.pop();
        expect(reefStage(progress)).toBe(stage - 1);
      }
    });
  });

  it("opens slots one at a time instead of in jumps", () => {
    let previous = 0;
    for (let score = 0; score <= REEF_THRESHOLDS[MAX_REEF_STAGE]; score += 1) {
      const progress = emptyProgress();
      progress.storyProgress.seen = Array.from({ length: score }, (_, index) => `capitulo-${index}`);
      const open = reefGrowth(progress).activeSlots.length;
      expect(open - previous).toBeLessThanOrEqual(1);
      previous = open;
    }
    expect(previous).toBeGreaterThan(1);
  });

  it("keeps stageProgress and vitality inside 0..1", () => {
    for (const score of [0, 7, 19, 20, 44, 80, 174, 175, 400]) {
      const progress = emptyProgress();
      progress.storyProgress.seen = Array.from({ length: score }, (_, index) => `capitulo-${index}`);
      const growth = reefGrowth(progress);
      expect(growth.stageProgress).toBeGreaterThanOrEqual(0);
      expect(growth.stageProgress).toBeLessThanOrEqual(1);
      expect(growth.vitality).toBeGreaterThanOrEqual(0);
      expect(growth.vitality).toBeLessThanOrEqual(1);
    }
  });

  it("reads every kind of unlock condition", () => {
    const empty = emptyProgress();
    expect(isDecorationUnlocked(decoration("coral-cerebro")!, empty)).toBe(true);
    expect(isDecorationUnlocked(decoration("concha-leque")!, empty)).toBe(false);

    const withLevel = emptyProgress();
    withLevel.completedLevels = ["recife-1", "recife-2"];
    expect(isDecorationUnlocked(decoration("concha-leque")!, withLevel)).toBe(true);
    expect(isDecorationUnlocked(decoration("alga-bolha")!, withLevel)).toBe(true);

    const withStars = emptyProgress();
    withStars.levelStars["recife-1"] = { stars: 3 as Stars, objectives: [], completions: 1, best: null, clearedDifficulties: [] };
    expect(isDecorationUnlocked(decoration("coral-leque-roxo")!, withStars)).toBe(true);

    const withSecret = emptyProgress();
    withSecret.discoveredSecrets = ["pedra-que-pisca"];
    expect(isDecorationUnlocked(decoration("pedra-que-pisca")!, withSecret)).toBe(true);

    const withEncounter = emptyProgress();
    withEncounter.completedEncounters = ["rede-fantasma"];
    expect(isDecorationUnlocked(decoration("estatua-guardia")!, withEncounter)).toBe(true);

    const withGuardians = emptyProgress();
    withGuardians.unlockedGuardians = GUARDIAN_ORDER.slice(0, 6);
    expect(isDecorationUnlocked(decoration("lanterna-agua-viva")!, withGuardians)).toBe(true);
  });

  it("reaches the last stage and unlocks the whole catalog on a finished campaign", () => {
    const growth = reefGrowth(completeProgress());
    expect(growth.stage).toBe(MAX_REEF_STAGE);
    expect(growth.vitality).toBe(1);
    expect(growth.activeSlots).toHaveLength(REEF_SLOTS.length);
    expect(growth.activeLandmarks).toHaveLength(REEF_LANDMARKS.length);
    // Nenhuma peça pode ficar inalcançável: um catálogo com entrada morta é conteúdo perdido.
    expect(growth.unlockedDecorationIds).toHaveLength(DECORATIONS.length);
  });

  it("keeps every starter slot kind stocked so a fresh reef is never empty", () => {
    const empty = emptyProgress();
    const starterKinds = new Set(REEF_SLOTS.filter((slot) => slot.order <= SLOT_STEP).map((slot) => slot.kind));
    for (const kind of starterKinds) {
      const available = slotsOfKind(kind).length > 0;
      expect(available).toBe(true);
      const hasDefault = DECORATIONS.some((definition) => definition.slots.includes(kind) && isDecorationUnlocked(definition, empty));
      expect(hasDefault, `nenhuma decoração inicial para ${kind}`).toBe(true);
    }
    expect(SLOT_KINDS.length).toBeGreaterThan(0);
  });
});
