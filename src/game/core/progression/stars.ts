import type { DifficultyRecord, LevelRecord, Stars } from "../save/PlayerProgress";
import type { MatchResult } from "./MatchResult";

export interface LevelMerge {
  next: LevelRecord;
  /** Objetivos cumpridos AGORA que ainda não estavam marcados, NA DIFICULDADE JOGADA. */
  newObjectives: boolean[];
  newStars: number;
  firstCompletion: boolean;
  firstPerfect: boolean;
  /** Estrelas da trilha da dificuldade jogada, antes e depois desta partida. */
  playedStars: Stars;
  playedStarsBefore: Stars;
  /** Objetivos da dificuldade jogada já cumpridos, somando o histórico. */
  playedObjectives: boolean[];
}

export const EMPTY_RECORD: LevelRecord = { stars: 0, objectives: [], completions: 0, best: null, clearedDifficulties: [], byDifficulty: {} };

/** A trilha de uma dificuldade, ou uma vazia quando a fase nunca foi vencida nela. */
export function difficultyTrack(record: LevelRecord | undefined, difficulty: string): DifficultyRecord {
  const stored = record?.byDifficulty?.[difficulty];
  if (stored) return stored;
  // O Normal tem um passado anterior às trilhas: os campos de cima SÃO a trilha dele.
  if (difficulty === "normal" && record) return { stars: record.stars, objectives: record.objectives, completions: record.completions };
  return { stars: 0, objectives: [], completions: 0 };
}

/** Estrelas = objetivos cumpridos. O primeiro objetivo é sempre concluir a fase. */
export function starsFromObjectives(objectives: readonly boolean[]): Stars {
  return Math.max(0, Math.min(3, objectives.filter(Boolean).length)) as Stars;
}

/**
 * Funde o resultado de uma partida com o histórico da fase (item 22). Estrelas nunca são retiradas:
 * um objetivo cumprido em qualquer tentativa fica marcado para sempre, e o "melhor" só melhora.
 * Derrota não mexe em nada além do contador de tentativas (que vive fora daqui).
 */
export function mergeLevelRecord(
  previous: LevelRecord | undefined,
  result: MatchResult,
  objectives: readonly boolean[],
  options: {
    /**
     * Como a partida se saiu contra os objetivos do NORMAL. Só faz diferença quando a vitória veio
     * numa dificuldade acima: vencer no Difícil é estritamente mais difícil, então uma corrida que
     * também cumpriu a missão do Normal continua marcando as estrelas de lá, como sempre marcou.
     */
    normalObjectives?: readonly boolean[];
  } = {},
): LevelMerge {
  const before = previous ?? EMPTY_RECORD;
  const difficulty = result.difficulty;
  const trackBefore = difficultyTrack(previous, difficulty);
  if (!result.victory) {
    return {
      next: {
        ...before,
        objectives: [...before.objectives],
        clearedDifficulties: [...before.clearedDifficulties],
        byDifficulty: { ...before.byDifficulty },
      },
      newObjectives: objectives.map(() => false),
      newStars: 0,
      firstCompletion: false,
      firstPerfect: false,
      playedStars: trackBefore.stars,
      playedStarsBefore: trackBefore.stars,
      playedObjectives: [...trackBefore.objectives],
    };
  }

  // Trilha da dificuldade jogada: é ela que a tela de resultado mostra e que paga as Conchas.
  const trackObjectives = objectives.map((achieved, index) => achieved || (trackBefore.objectives[index] ?? false));
  const newObjectives = objectives.map((achieved, index) => achieved && !(trackBefore.objectives[index] ?? false));
  const trackStars = starsFromObjectives(trackObjectives);

  // Trilha do Normal: continua sendo o que manda nas estrelas da campanha e nos desbloqueios.
  const normalFlags = difficulty === "normal" ? objectives : (options.normalObjectives ?? objectives);
  const merged = normalFlags.map((achieved, index) => achieved || (before.objectives[index] ?? false));
  const stars = starsFromObjectives(merged);
  const best = improveBest(before.best, result);
  // Esta função monta `next` DO ZERO: campo que não for propagado aqui é apagado em toda vitória.
  const clearedDifficulties = before.clearedDifficulties.includes(difficulty)
    ? [...before.clearedDifficulties]
    : [...before.clearedDifficulties, difficulty];
  const completions = before.completions + 1;
  const normalBefore = difficultyTrack(previous, "normal");
  const byDifficulty: Record<string, DifficultyRecord> = {
    ...before.byDifficulty,
    [difficulty]: { stars: trackStars, objectives: trackObjectives, completions: trackBefore.completions + 1 },
  };
  // A trilha do Normal é sempre o espelho dos campos de cima: um só lugar decide as estrelas da campanha.
  byDifficulty.normal = {
    stars,
    objectives: merged,
    completions: difficulty === "normal" ? normalBefore.completions + 1 : normalBefore.completions,
  };
  return {
    next: { stars, objectives: merged, completions, best, clearedDifficulties, byDifficulty },
    newObjectives,
    newStars: Math.max(0, trackStars - trackBefore.stars),
    firstCompletion: before.completions === 0,
    firstPerfect: trackStars === 3 && trackBefore.stars < 3,
    playedStars: trackStars,
    playedStarsBefore: trackBefore.stars,
    playedObjectives: trackObjectives,
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
    distinctGuardians: result.stats.distinctGuardiansUsed.length,
  };
  if (!before) return candidate;
  return {
    livesLost: Math.min(before.livesLost, candidate.livesLost),
    durationMs: Math.min(before.durationMs, candidate.durationMs),
    guardiansUsed: Math.min(before.guardiansUsed, candidate.guardiansUsed),
    difficulty: candidate.difficulty,
    distinctGuardians: Math.min(before.distinctGuardians ?? Number.POSITIVE_INFINITY, candidate.distinctGuardians),
  };
}
