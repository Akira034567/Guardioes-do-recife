import type { LevelProgressApi } from "../core/LevelProgress";
import { SaveManager, type SaveStorage } from "../core/save/SaveManager";
import { ENEMY_ORDER } from "../data/enemies";
import { GUARDIAN_ORDER } from "../data/guardians";
import { DEFAULT_UNLOCKED_GUARDIANS } from "../data/unlocks";
import { LEVEL_IDS } from "../data/levels";

let manager: SaveManager | null = null;

function browserStorage(): SaveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Único `SaveManager` da página; cai para memória quando não há localStorage. */
export function getSaveManager(): SaveManager {
  if (!manager) {
    manager = new SaveManager(browserStorage(), {
      registry: { levelIds: LEVEL_IDS, guardianIds: GUARDIAN_ORDER, enemyIds: ENEMY_ORDER, defaultUnlockedGuardians: DEFAULT_UNLOCKED_GUARDIANS },
    });
  }
  return manager;
}

/** Progressão de fases (API antiga) por cima do save versionado. */
export function createLevelProgress(): LevelProgressApi {
  return getSaveManager().levelProgress();
}
