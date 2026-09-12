import type { GuardianId } from "../../types";
import type { MatchStatsSnapshot } from "../match/MatchStats";

/**
 * Tudo que a progressão precisa saber de uma partida que acabou. É montado pela apresentação a partir
 * do `MatchSnapshot` e do contexto da fase; a progressão nunca olha o motor.
 */
export interface MatchResult {
  levelId: string;
  /** Fase da campanha (padrão) ou Encontro: o Encontro não vale estrela e conclui um `encounterId`. */
  kind?: "campaign" | "encounter";
  encounterId?: string;
  difficulty: string;
  victory: boolean;
  livesRemaining: number;
  maxLives: number;
  loadout: GuardianId[];
  /** O esquadrão veio de `?guardians=` (teste/balanceamento), não da progressão do jogador. */
  loadoutOverride: boolean;
  stats: MatchStatsSnapshot;
}

/** Partidas com comandos de debug não valem estrelas, Conchas nem desbloqueios. */
export function countsForProgression(result: MatchResult): boolean {
  return !result.stats.cheated;
}
