import type { LevelRecord, Stars } from "../save/PlayerProgress";
import type { MatchResult } from "./MatchResult";

export interface LevelMerge {
  next: LevelRecord;
  /** Objetivos cumpridos AGORA que ainda não estavam marcados. */
  newObjectives: boolean[];
  newStars: number;
  firstCompletion: boolean;
  firstPerfect: boolean;
}

export const EMPTY_RECORD: LevelRecord = { stars: 0, objectives: [], completions: 0, best: null };

/** Estrelas = objetivos cumpridos. O primeiro objetivo é sempre concluir a fase. */
export function starsFromObjectives(objectives: readonly boolean[]): Stars {
  return Math.max(0, Math.min(3, objectives.filter(Boolean).length)) as Stars;
}

/**
 * Funde o resultado de uma partida com o histórico da fase (item 22). Estrelas nunca são retiradas:
 * um objetivo cumprido em qualquer tentativa fica marcado para sempre, e o "melhor" só melhora.
 * Derrota não mexe em nada além do contador de tentativas (que vive fora daqui).
 */
export function mergeLevelRecord(previous: LevelRecord | undefined, result: MatchResult, objectives: readonly boolean[]): LevelMerge {
  const before = previous ?? EMPTY_RECORD;
  if (!result.victory) {
    return { next: { ...before, objectives: [...before.objectives] }, newObjectives: objectives.map(() => false), newStars: 0, firstCompletion: false, firstPerfect: false };
  }
  const merged = objectives.map((achieved, index) => achieved || (before.objectives[index] ?? false));
  const newObjectives = objectives.map((achieved, index) => achieved && !(before.objectives[index] ?? false));
  const stars = starsFromObjectives(merged);
  const best = improveBest(before.best, result);
  return {
    next: { stars, objectives: merged, completions: before.completions + 1, best },
    newObjectives,
    newStars: Math.max(0, stars - before.stars),
    firstCompletion: before.completions === 0,
    firstPerfect: stars === 3 && before.stars < 3,
  };
}

/** Total de estrelas do jogador (para desbloqueios por estrelas). */
export function totalStars(records: Record<string, LevelRecord>): number {
  return Object.values(records).reduce((total, record) => total + record.stars, 0);
}

function improveBest(before: LevelRecord["best"], result: MatchResult): LevelRecord["best"] {
  const candidate = {
    livesLost: result.stats.livesLost,
    durationMs: result.stats.timeMs,
    guardiansUsed: result.stats.maxSimultaneousGuardians,
    difficulty: result.difficulty,
  };
  if (!before) return candidate;
  return {
    livesLost: Math.min(before.livesLost, candidate.livesLost),
    durationMs: Math.min(before.durationMs, candidate.durationMs),
    guardiansUsed: Math.min(before.guardiansUsed, candidate.guardiansUsed),
    difficulty: candidate.difficulty,
  };
}
