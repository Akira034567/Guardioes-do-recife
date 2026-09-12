import { DIFFICULTY_REWARD_MULTIPLIER, REWARDS } from "../../data/progression";
import type { LevelMerge } from "./stars";

export interface RewardLine {
  label: string;
  shells: number;
}

export interface RewardBreakdown {
  shells: number;
  lines: RewardLine[];
}

/**
 * Encontro paga uma vez: é a caçada que vale, não a repetição. Repetir rende um agrado simbólico.
 */
export function encounterRewards(progress: { completedEncounters: readonly string[] }, result: { encounterId?: string; levelId: string; difficulty: string }): RewardBreakdown {
  const encounterId = result.encounterId ?? result.levelId;
  const first = !progress.completedEncounters.includes(encounterId);
  const base = first ? REWARDS.firstCompletion : REWARDS.replayVictory;
  const shells = Math.round(base * (DIFFICULTY_REWARD_MULTIPLIER[result.difficulty] ?? 1));
  return { shells, lines: [{ label: first ? "Guardião encontrado" : "Encontro revisitado", shells }] };
}

/**
 * Conchas de uma vitória (item 2): primeira conclusão, cada estrela nova, a primeira vez com 3/3 e um
 * agrado por repetir a fase. Dificuldades maiores multiplicam o total.
 */
export function computeLevelRewards(merge: LevelMerge, difficulty: string, table = REWARDS): RewardBreakdown {
  const lines: RewardLine[] = [];
  if (merge.firstCompletion) lines.push({ label: "Primeira conclusão", shells: table.firstCompletion });
  if (merge.newStars > 0) lines.push({ label: `${merge.newStars} estrela${merge.newStars > 1 ? "s" : ""} nova${merge.newStars > 1 ? "s" : ""}`, shells: table.perNewStar * merge.newStars });
  if (merge.firstPerfect) lines.push({ label: "Recife impecável (3/3)", shells: table.firstPerfect });
  if (lines.length === 0 && merge.next.completions > 0) lines.push({ label: "Recife defendido de novo", shells: table.replayVictory });

  const multiplier = DIFFICULTY_REWARD_MULTIPLIER[difficulty] ?? 1;
  const scaled = lines.map((line) => ({ label: line.label, shells: Math.round(line.shells * multiplier) }));
  return { shells: scaled.reduce((total, line) => total + line.shells, 0), lines: scaled };
}
