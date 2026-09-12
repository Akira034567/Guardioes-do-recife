import { difficultyOf, type DifficultyId } from "../data/difficulty";
import { resolveLoadout } from "../data/guardians";
import { getLevel, LEVELS } from "../data/levels";
import type { GuardianId, LevelDefinition } from "../types";

/** Tudo que a `GameScene` precisa para montar uma partida, vindo da preparação ou da URL. */
export interface MatchLaunchConfig {
  levelId: string;
  difficulty: DifficultyId;
  loadout: GuardianId[];
  /** O esquadrão veio de `?guardians=`: não conta como escolha do jogador. */
  loadoutOverride: boolean;
  /** Dicas do tutorial ligadas; `?tutorial=0` desliga (testes e e2e). */
  tutorial: boolean;
  /** Desafio do dia/semana que esta partida está cumprindo (item 38). */
  challengeId?: string;
  debug: { enabled: boolean; startWave: number };
}

export interface LaunchContext {
  unlockedGuardians?: readonly GuardianId[];
  lastLoadout?: readonly GuardianId[];
  lastDifficulty?: string;
}

/**
 * Lê os atalhos de URL (`?level=`, `?guardians=`, `?difficulty=`, `?debug=1&wave=N`) e completa o que
 * faltar com a progressão do jogador. Tira esse parse de dentro da cena.
 */
export function launchConfigFromUrl(search: URLSearchParams, context: LaunchContext = {}): MatchLaunchConfig {
  const level = getLevel(search.get("level")) ?? LEVELS[0];
  const guardiansParam = search.get("guardians");
  const debugEnabled = search.get("debug") === "1";
  const wave = Number(search.get("wave") ?? 1) - 1;
  return {
    levelId: level.id,
    difficulty: difficultyOf(search.get("difficulty") ?? context.lastDifficulty).id,
    loadout: resolveLoadout(guardiansParam, { unlocked: context.unlockedGuardians, fallback: context.lastLoadout }),
    loadoutOverride: Boolean(guardiansParam),
    tutorial: search.get("tutorial") !== "0",
    debug: { enabled: debugEnabled, startWave: debugEnabled && Number.isFinite(wave) ? Math.max(0, wave) : 0 },
  };
}

/** Configuração de uma partida escolhida na tela de preparação. */
export function launchConfigFor(
  level: LevelDefinition,
  difficulty: DifficultyId,
  loadout: readonly GuardianId[],
  options: { challengeId?: string } = {},
): MatchLaunchConfig {
  return {
    levelId: level.id,
    difficulty,
    loadout: [...loadout],
    loadoutOverride: false,
    tutorial: true,
    challengeId: options.challengeId,
    debug: { enabled: false, startWave: 0 },
  };
}
