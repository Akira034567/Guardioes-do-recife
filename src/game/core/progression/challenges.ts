import { DIFFICULTY_IDS, type DifficultyId } from "../../data/difficulty";
import { LEVEL_IDS } from "../../data/levels";
import { GUARDIAN_ORDER, LOADOUT_SIZE } from "../../data/guardians";
import type { GuardianId, LevelObjectiveDefinition } from "../../types";
import { createRng } from "../Rng";

/**
 * Desafios (item 38). Não precisam de servidor: a rotação é sorteada a partir da data, com a mesma
 * semente para todo mundo. Um desafio é uma fase que já existe com a mão amarrada — esquadrão fixo,
 * dificuldade fixa e um objetivo extra.
 */
export type ChallengeKind = "daily" | "weekly";

export interface ChallengeDefinition {
  id: string;
  kind: ChallengeKind;
  name: string;
  levelId: string;
  difficulty: DifficultyId;
  /** Esquadrão obrigatório: é isso que faz o desafio ser um desafio. */
  loadout: GuardianId[];
  objective: LevelObjectiveDefinition;
  shells: number;
  /** Rótulo do período, também usado como id do sorteio. */
  rotation: string;
}

/** Dia em ISO (`2026-09-12`), no fuso local do jogador. */
export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Semana ISO (`2026-W37`): segunda a domingo. */
export function weekKey(date: Date): string {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Quando o desafio vira: o do dia na próxima meia-noite local, o da semana na segunda-feira seguinte.
 * É a mesma conta que `dayKey`/`weekKey` fazem para sortear, vista do outro lado — então o relógio do
 * mapa nunca discorda do desafio que está no ar.
 */
export function challengeExpiresAt(kind: ChallengeKind, date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + (kind === "daily" ? 1 : 8 - (date.getDay() || 7)));
  return next;
}

const OBJECTIVES: Array<{ definition: LevelObjectiveDefinition; label: string }> = [
  { definition: { id: "desafio-sem-vazar", kind: "noLeaks" }, label: "sem deixar ninguém passar" },
  { definition: { id: "desafio-vidas", kind: "minLivesRemaining", value: 15 }, label: "com 15 vidas ou mais" },
  { definition: { id: "desafio-tempo", kind: "underTimeMs", value: 300_000 }, label: "em menos de 5 minutos" },
  { definition: { id: "desafio-poucos", kind: "maxGuardians", value: 4 }, label: "com no máximo 4 Guardiões" },
];

/**
 * Sorteia o desafio de um período. A semente é só a data, então a rotação é a mesma para todo mundo;
 * o sorteio, porém, só usa fases e Guardiões que o jogador já alcançou — desafio não é spoiler nem
 * parede. Nada vem da rede.
 */
export function rollChallenge(
  kind: ChallengeKind,
  rotation: string,
  unlockedGuardians: readonly GuardianId[],
  unlockedLevels: readonly string[] = LEVEL_IDS,
): ChallengeDefinition {
  const rng = createRng(`${kind}:${rotation}`);
  const reachable = LEVEL_IDS.filter((id) => unlockedLevels.includes(id));
  const playable = reachable.length > 0 ? reachable : [LEVEL_IDS[0]];
  // O desafio do dia evita a última fase alcançada; o da semana pode usá-la.
  const levels = kind === "weekly" ? playable : playable.slice(0, Math.max(1, playable.length - (playable.length > 1 ? 1 : 0)));
  const levelId = rng.pick(levels);
  const difficulty = kind === "weekly" ? DIFFICULTY_IDS[Math.min(DIFFICULTY_IDS.length - 1, 1 + rng.int(2))] : DIFFICULTY_IDS[rng.int(2)];
  const objective = rng.pick(OBJECTIVES);

  // O esquadrão sai só de quem o jogador já encontrou, para o desafio nunca ser impossível.
  const squadPool = GUARDIAN_ORDER.filter((guardianId) => unlockedGuardians.includes(guardianId));
  const available: GuardianId[] = squadPool.length > 0 ? [...squadPool] : [...GUARDIAN_ORDER];
  const loadout: GuardianId[] = [];
  const size = Math.min(LOADOUT_SIZE, available.length);
  while (loadout.length < size) {
    const index = rng.int(available.length);
    loadout.push(available.splice(index, 1)[0]);
  }

  return {
    id: `${kind}:${rotation}`,
    kind,
    name: kind === "weekly" ? "Desafio da semana" : "Desafio do dia",
    levelId,
    difficulty,
    loadout,
    objective: objective.definition,
    shells: kind === "weekly" ? 60 : 25,
    rotation,
  };
}

/** Os dois desafios abertos agora. */
export function currentChallenges(date: Date, unlockedGuardians: readonly GuardianId[], unlockedLevels?: readonly string[]): ChallengeDefinition[] {
  return [
    rollChallenge("daily", dayKey(date), unlockedGuardians, unlockedLevels),
    rollChallenge("weekly", weekKey(date), unlockedGuardians, unlockedLevels),
  ];
}

/** Texto curto do que o desafio pede. */
export function challengeRule(challenge: ChallengeDefinition): string {
  const objective = OBJECTIVES.find((candidate) => candidate.definition.kind === challenge.objective.kind);
  return objective?.label ?? "sem regra extra";
}
