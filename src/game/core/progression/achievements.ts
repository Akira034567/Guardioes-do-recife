import { ACHIEVEMENTS, type AchievementDefinition } from "../../data/achievements";
import { LEVEL_IDS } from "../../data/levels";
import type { PlayerProgress } from "../save/PlayerProgress";
import type { MatchResult } from "./MatchResult";
import { totalStars } from "./stars";

export interface AchievementStatus {
  definition: AchievementDefinition;
  progress: number;
  target: number;
  unlocked: boolean;
  /** Conquistada agora, nesta partida. */
  isNew: boolean;
}

/**
 * Conquistas (item 37): medidas puras sobre o save já atualizado, mais o resultado da partida que
 * acabou (para as marcas de uma única partida). Progresso nunca regride.
 */
export function measureAchievement(definition: AchievementDefinition, progress: PlayerProgress, result?: MatchResult): number {
  const stored = progress.achievements[definition.id]?.progress ?? 0;
  const measure = definition.measure;
  switch (measure.type) {
    case "totalKills":
      return progress.totals.kills;
    case "totalVictories":
      return progress.totals.victories;
    case "wavesCleared":
      return progress.totals.wavesCleared;
    case "playTimeMinutes":
      return Math.floor(progress.totals.playTimeMs / 60_000);
    case "levelsCompleted":
      return progress.completedLevels.length;
    case "starsTotal":
      return totalStars(progress.levelStars);
    case "perfectLevels":
      return Object.values(progress.levelStars).filter((record) => record.stars >= 3).length;
    case "guardiansFound":
      return progress.unlockedGuardians.length;
    case "encountersCompleted":
      return progress.completedEncounters.length;
    case "secretsFound":
      return progress.discoveredSecrets.length;
    case "enemiesCatalogued":
      return Object.keys(progress.enemyDiscovery).length;
    case "storiesRead":
      return progress.storyProgress.seen.length;
    case "bestInMatch": {
      // A melhor marca já registrada continua valendo; a partida só pode melhorá-la.
      if (!result) return stored;
      const stats = result.stats;
      const value =
        measure.stat === "enemiesKilled"
          ? stats.enemiesKilled
          : measure.stat === "pearlsEarned"
            ? stats.pearlsEarned
            : measure.stat === "upgradesBought"
              ? stats.upgradesBought
              : stats.maxSimultaneousGuardians;
      return Math.max(stored, value);
    }
    case "campaignBest": {
      // Só a campanha entra: Encontro não tem estrela nem recorde comparável.
      return LEVEL_IDS.filter((levelId) => {
        const best = progress.levelStars[levelId]?.best;
        if (!best) return false;
        const value = measure.stat === "livesLost" ? best.livesLost : best.distinctGuardians;
        // `undefined` = save antigo, que nunca mediu espécies. Conta como "ainda não", nunca como 0.
        return value !== undefined && value <= measure.max;
      }).length;
    }
    case "campaignWithoutRestart":
      return progress.totals.restarts > 0 ? 0 : progress.completedLevels.filter((levelId) => LEVEL_IDS.includes(levelId)).length;
    case "matchesWith": {
      if (!result || !result.victory) return stored;
      const satisfied =
        measure.condition === "noLeaks"
          ? result.stats.enemiesLeaked === 0
          : measure.condition === "hardDifficulty"
            ? result.difficulty === "abissal"
            : result.stats.distinctGuardiansUsed.length === 1;
      return stored + (satisfied ? 1 : 0);
    }
  }
}

/**
 * Atualiza o progresso de todas as conquistas no rascunho do save e devolve as que caíram agora.
 * Conquista já obtida nunca é recalculada para menos.
 */
export function applyAchievements(draft: PlayerProgress, result?: MatchResult, now = new Date()): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];
  for (const definition of ACHIEVEMENTS) {
    const entry = draft.achievements[definition.id] ?? { progress: 0, unlockedAt: null, claimed: false };
    const measured = Math.max(entry.progress, measureAchievement(definition, draft, result));
    entry.progress = measured;
    if (!entry.unlockedAt && measured >= definition.target) {
      entry.unlockedAt = now.toISOString();
      unlocked.push(definition);
    }
    draft.achievements[definition.id] = entry;
  }
  return unlocked;
}

/**
 * Lista para a tela de conquistas.
 *
 * As secretas ficam FORA enquanto não caem: elas não existem para quem ainda não as fez, nem como
 * "???" — e entram na lista no instante em que são conquistadas. Quem quiser a lista crua (testes,
 * ferramentas) passa `includeSecret`.
 */
export function achievementStatuses(
  progress: PlayerProgress,
  justUnlocked: readonly string[] = [],
  options: { includeSecret?: boolean } = {},
): AchievementStatus[] {
  return ACHIEVEMENTS.filter(
    (definition) => options.includeSecret === true || definition.secret !== true || Boolean(progress.achievements[definition.id]?.unlockedAt),
  ).map((definition) => {
    const entry = progress.achievements[definition.id];
    const value = Math.min(definition.target, entry?.progress ?? 0);
    return {
      definition,
      progress: value,
      target: definition.target,
      unlocked: Boolean(entry?.unlockedAt),
      isNew: justUnlocked.includes(definition.id),
    };
  });
}

/** Conchas somadas das conquistas recém-obtidas. */
export function achievementShells(unlocked: readonly AchievementDefinition[]): number {
  return unlocked.reduce((total, definition) => total + definition.shells, 0);
}
