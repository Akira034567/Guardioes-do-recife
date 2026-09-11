import { LevelProgress } from "../core/LevelProgress";
import { LEVEL_IDS } from "../data/levels";

/** Progresso persistido no navegador; cai para memória quando não há localStorage. */
export function createLevelProgress(): LevelProgress {
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return new LevelProgress(LEVEL_IDS, storage);
}
