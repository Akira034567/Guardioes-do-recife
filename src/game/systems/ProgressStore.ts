import type { LevelProgressApi } from "../core/LevelProgress";
import { SaveManager } from "../core/save/SaveManager";
import { ENEMY_ORDER } from "../data/enemies";
import { GUARDIAN_ORDER } from "../data/guardians";
import { DECORATION_IDS } from "../data/reef/decorations";
import { DEFAULT_UNLOCKED_GUARDIANS } from "../data/unlocks";
import { LEVEL_IDS } from "../data/levels";
import { DIFFICULTY_IDS } from "../data/difficulty";
import { browserStorage, getSession } from "./accounts";

let manager: SaveManager | null = null;

/**
 * Único `SaveManager` da página; cai para memória quando não há localStorage.
 *
 * A chave vem da sessão: entrar numa conta é abrir OUTRO documento de save, e quem joga sem conta
 * continua no save do aparelho. Por isso `resetSaveManager()` existe — entrar ou sair precisa
 * derrubar este singleton para o próximo acesso abrir o save certo.
 */
export function getSaveManager(): SaveManager {
  if (!manager) {
    const session = getSession();
    manager = new SaveManager(browserStorage(), {
      key: session.saveKey(),
      // O save pré-versionamento é do APARELHO: só o convidado o herda, uma conta nova começa limpa.
      legacyKey: session.current ? null : undefined,
      registry: {
        levelIds: LEVEL_IDS,
        guardianIds: GUARDIAN_ORDER,
        enemyIds: ENEMY_ORDER,
        defaultUnlockedGuardians: DEFAULT_UNLOCKED_GUARDIANS,
        decorationIds: DECORATION_IDS,
        difficultyIds: DIFFICULTY_IDS,
      },
    });
  }
  return manager;
}

/** Descarta o save aberto: a próxima chamada abre o da conta que estiver ativa agora. */
export function resetSaveManager(): void {
  manager = null;
}

/** Progressão de fases (API antiga) por cima do save versionado. */
export function createLevelProgress(): LevelProgressApi {
  return getSaveManager().levelProgress();
}
