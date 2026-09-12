import type { EnemyRole, TargetPolicyMode, Vec2 } from "../types";
import { isInRange } from "./Combat";

/** O que uma política de alvo precisa saber de um inimigo (`Enemy` e `SimEnemy` satisfazem). */
export interface TargetCandidate extends Vec2 {
  id: string;
  progress: number;
  health: number;
  dead: boolean;
  reachedGoal: boolean;
  definition: { role: EnemyRole; isBoss?: boolean; maxHealth: number };
}

export interface TargetPolicy {
  mode: TargetPolicyMode;
  /** `wounded`: fração de vida abaixo da qual o inimigo tem prioridade. */
  threshold?: number;
  /** Alvo coordenado (Sonar II): vence tudo, mas só se estiver ao alcance. */
  preferredId?: string | null;
  /** Presa marcada (Alfa): vence a ordenação normal, se estiver ao alcance. */
  markedId?: string | null;
}

export function threatTier(candidate: Pick<TargetCandidate, "definition">): number {
  if (candidate.definition.isBoss || candidate.definition.role === "boss") return 2;
  if (candidate.definition.role === "elite") return 1;
  return 0;
}

/** Ordem decrescente de ameaça: chefe > elite > mais vida máxima > mais avançado na rota. */
export function compareThreat(a: TargetCandidate, b: TargetCandidate): number {
  const tier = threatTier(b) - threatTier(a);
  if (tier !== 0) return tier;
  const health = b.definition.maxHealth - a.definition.maxHealth;
  if (health !== 0) return health;
  return b.progress - a.progress;
}

export function isWounded(candidate: TargetCandidate, threshold: number): boolean {
  return candidate.health / Math.max(1, candidate.definition.maxHealth) < threshold;
}

export function aliveInRange<T extends TargetCandidate>(candidates: readonly T[], origin: Vec2, range: number): T[] {
  return candidates.filter((candidate) => !candidate.dead && !candidate.reachedGoal && isInRange(origin, candidate, range));
}

/** Melhor alvo segundo a política. Nunca devolve algo fora do alcance. */
export function selectTarget<T extends TargetCandidate>(
  candidates: readonly T[],
  origin: Vec2,
  range: number,
  policy: TargetPolicy,
): T | undefined {
  const pool = aliveInRange(candidates, origin, range);
  if (pool.length === 0) return undefined;
  if (policy.preferredId) {
    const preferred = pool.find((candidate) => candidate.id === policy.preferredId);
    if (preferred) return preferred;
  }
  if (policy.markedId) {
    const marked = pool.find((candidate) => candidate.id === policy.markedId);
    if (marked) return marked;
  }
  switch (policy.mode) {
    case "lowestHealth":
      return [...pool].sort((a, b) => a.health - b.health || b.progress - a.progress)[0];
    case "wounded": {
      const threshold = policy.threshold ?? 0.4;
      return [...pool].sort((a, b) => {
        const woundedDelta = Number(isWounded(b, threshold)) - Number(isWounded(a, threshold));
        return woundedDelta !== 0 ? woundedDelta : b.progress - a.progress;
      })[0];
    }
    case "threat":
      return [...pool].sort(compareThreat)[0];
    default:
      return [...pool].sort((a, b) => b.progress - a.progress)[0];
  }
}

/** Maior ameaça ao alcance (para marcar presa e para o Sonar). */
export function selectThreat<T extends TargetCandidate>(candidates: readonly T[], origin: Vec2, range: number): T | undefined {
  return selectTarget(candidates, origin, range, { mode: "threat" });
}
