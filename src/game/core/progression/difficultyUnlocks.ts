import { DIFFICULTIES, DIFFICULTY_IDS, isDifficultyId, type DifficultyId } from "../../data/difficulty";
import type { PlayerProgress } from "../save/PlayerProgress";

/**
 * Desbloqueio de dificuldade (item 4). É GLOBAL da campanha, nunca por fase: terminar todas as
 * fases no Normal abre o Difícil, terminar todas no Difícil abre o Abissal.
 *
 * A comparação é por POSTO, não por igualdade — vencer uma fase no Abissal também satisfaz o
 * requisito de Normal e de Difícil para ela. Quem sobe direto não é obrigado a voltar e repetir.
 */

export interface DifficultyGate {
  id: DifficultyId;
  unlocked: boolean;
  /** O que falta, em uma linha, para o texto de bloqueio. */
  requirement: string;
  progress: { current: number; target: number };
}

const rankOf = (id: string): number => DIFFICULTY_IDS.indexOf(id as DifficultyId);

/** Maior dificuldade em que esta fase já foi vencida; -1 se ainda não caiu nenhuma vez. */
function clearedRank(progress: Readonly<PlayerProgress>, levelId: string): number {
  const record = progress.levelStars[levelId];
  if (!record) return -1;
  return record.clearedDifficulties.reduce((best, id) => Math.max(best, rankOf(id)), -1);
}

/** Quantas fases da campanha já caíram na dificuldade de posto `rank` (ou acima). */
function clearedCount(progress: Readonly<PlayerProgress>, levelIds: readonly string[], rank: number): number {
  return levelIds.filter((levelId) => clearedRank(progress, levelId) >= rank).length;
}

export function difficultyGates(progress: Readonly<PlayerProgress>, levelIds: readonly string[]): DifficultyGate[] {
  return DIFFICULTY_IDS.map((id, rank) => {
    if (rank === 0) {
      return { id, unlocked: true, requirement: "", progress: { current: levelIds.length, target: levelIds.length } };
    }
    const previous = DIFFICULTIES[DIFFICULTY_IDS[rank - 1]];
    const current = clearedCount(progress, levelIds, rank - 1);
    const target = levelIds.length;
    return {
      id,
      unlocked: target > 0 && current >= target,
      requirement: `Conclua as ${target} fases no ${previous.name} (${current}/${target}).`,
      progress: { current, target },
    };
  });
}

export function isDifficultyUnlocked(progress: Readonly<PlayerProgress>, levelIds: readonly string[], id: DifficultyId): boolean {
  return difficultyGates(progress, levelIds).find((gate) => gate.id === id)?.unlocked ?? false;
}

export function highestUnlockedDifficulty(progress: Readonly<PlayerProgress>, levelIds: readonly string[]): DifficultyId {
  const unlocked = difficultyGates(progress, levelIds).filter((gate) => gate.unlocked);
  return unlocked[unlocked.length - 1]?.id ?? "normal";
}

/** Limita um valor ao que o jogador já abriu. Use na UI; NUNCA nos atalhos de URL (ver abaixo). */
export function clampDifficulty(value: string | null | undefined, progress: Readonly<PlayerProgress>, levelIds: readonly string[]): DifficultyId {
  if (!isDifficultyId(value)) return "normal";
  return isDifficultyUnlocked(progress, levelIds, value) ? value : "normal";
}
