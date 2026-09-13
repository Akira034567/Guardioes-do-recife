import type { EnemyRole, EnemyTag, TargetPolicyMode, Vec2 } from "../types";
import { RADIAL, shapeContains, type ShapePoint, type TargetingShape, type TargetOrigin } from "./TargetingShape";

/**
 * Estratégias de escolha de alvo (item 19). Os quatro modos antigos continuam válidos como apelidos:
 * `leading` = FIRST, `lowestHealth` = LOWEST_HEALTH, `wounded` = WOUNDED, `threat` = THREAT.
 */
export type TargetStrategy =
  | "FIRST"
  | "LAST"
  | "CLOSEST"
  | "FARTHEST"
  | "STRONGEST"
  | "WEAKEST"
  | "LOWEST_HEALTH"
  | "HIGHEST_HEALTH"
  | "MARKED"
  | "ELITE"
  | "BOSS"
  | "WOUNDED"
  | "THREAT"
  /** Pontos fracos primeiro; empata pelo mesmo critério de ameaça (item 12). */
  | "WEAK_POINT";

export const LEGACY_TARGETING: Record<TargetPolicyMode, TargetStrategy> = {
  leading: "FIRST",
  lowestHealth: "LOWEST_HEALTH",
  wounded: "WOUNDED",
  threat: "THREAT",
};

/** O que uma política de alvo precisa saber de um inimigo (`MatchEnemy` satisfaz). */
export interface TargetCandidate extends ShapePoint {
  id: string;
  progress: number;
  health: number;
  dead: boolean;
  reachedGoal: boolean;
  definition: { role: EnemyRole; isBoss?: boolean; maxHealth: number; tags?: EnemyTag[] };
  /** Camuflados: falso enquanto escondidos. Ausente = sempre mirável. */
  isTargetable?(now: number): boolean;
  status?: { isMarked(now: number): boolean };
}

export interface TargetPolicy {
  mode: TargetPolicyMode | TargetStrategy;
  /** `WOUNDED`: fração de vida abaixo da qual o inimigo tem prioridade. */
  threshold?: number;
  /** Alvo coordenado (Sonar II): vence tudo, mas só se estiver ao alcance. */
  preferredId?: string | null;
  /** Presa marcada (Alfa): vence a ordenação normal, se estiver ao alcance. */
  markedId?: string | null;
  /** Forma do alcance; ausente = radial. */
  shape?: TargetingShape;
  /**
   * Categorias em ordem de preferência (item 12). AUSENTE = comportamento idêntico ao de sempre —
   * é o que garante que os Guardiões que não pedem prioridade nenhuma não mudem em nada.
   */
  priority?: readonly TargetTier[];
}

export function normalizeStrategy(mode: TargetPolicyMode | TargetStrategy): TargetStrategy {
  return (LEGACY_TARGETING as Record<string, TargetStrategy>)[mode] ?? (mode as TargetStrategy);
}

/**
 * Categorias de alvo (item 12). São genéricas: nenhum Guardião conhece "coral" nem "baleia", só
 * pede uma ORDEM de categorias, e qualquer chefe futuro reaproveita a mesma mecânica marcando as
 * entidades filhas com a etiqueta `WEAK_POINT`.
 */
export type TargetTier = "weakPoint" | "elite" | "boss" | "normal";

/** A ordem pedida no item 12: ponto fraco de chefe > elite > chefe > comum. */
export const WEAK_POINT_FIRST: readonly TargetTier[] = ["weakPoint", "elite", "boss", "normal"];

export function isWeakPoint(candidate: Pick<TargetCandidate, "definition">): boolean {
  const tags = candidate.definition.tags;
  return Boolean(tags?.includes("WEAK_POINT") || tags?.includes("PRIORITY_TARGET"));
}

export function tierOf(candidate: Pick<TargetCandidate, "definition">): TargetTier {
  if (isWeakPoint(candidate)) return "weakPoint";
  if (candidate.definition.role === "elite" || candidate.definition.tags?.includes("ELITE")) return "elite";
  if (candidate.definition.isBoss || candidate.definition.role === "boss") return "boss";
  return "normal";
}

export function threatTier(candidate: Pick<TargetCandidate, "definition">): number {
  if (isWeakPoint(candidate)) return 3;
  if (candidate.definition.isBoss || candidate.definition.role === "boss") return 2;
  if (candidate.definition.role === "elite") return 1;
  return 0;
}

/** Ordem decrescente de ameaça: ponto fraco > chefe > elite > mais vida máxima > mais avançado. */
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

interface CompareContext {
  origin: TargetOrigin;
  threshold: number;
  now: number;
}

const distance = (origin: Vec2, candidate: Vec2): number => Math.hypot(candidate.x - origin.x, candidate.y - origin.y);
/** Desempate comum a todas as estratégias: o mais avançado na rota. */
const byProgress = (a: TargetCandidate, b: TargetCandidate): number => b.progress - a.progress;
const isElite = (candidate: TargetCandidate): boolean =>
  candidate.definition.role === "elite" || Boolean(candidate.definition.tags?.includes("ELITE"));

const COMPARATORS: Record<TargetStrategy, (a: TargetCandidate, b: TargetCandidate, context: CompareContext) => number> = {
  FIRST: (a, b) => byProgress(a, b),
  LAST: (a, b) => a.progress - b.progress,
  CLOSEST: (a, b, context) => distance(context.origin, a) - distance(context.origin, b) || byProgress(a, b),
  FARTHEST: (a, b, context) => distance(context.origin, b) - distance(context.origin, a) || byProgress(a, b),
  STRONGEST: (a, b) => b.definition.maxHealth - a.definition.maxHealth || byProgress(a, b),
  WEAKEST: (a, b) => a.definition.maxHealth - b.definition.maxHealth || byProgress(a, b),
  LOWEST_HEALTH: (a, b) => a.health - b.health || byProgress(a, b),
  HIGHEST_HEALTH: (a, b) => b.health - a.health || byProgress(a, b),
  MARKED: (a, b, context) => Number(b.status?.isMarked(context.now) ?? false) - Number(a.status?.isMarked(context.now) ?? false) || byProgress(a, b),
  ELITE: (a, b) => Number(isElite(b)) - Number(isElite(a)) || byProgress(a, b),
  BOSS: (a, b) => threatTier(b) - threatTier(a) || byProgress(a, b),
  WOUNDED: (a, b, context) => Number(isWounded(b, context.threshold)) - Number(isWounded(a, context.threshold)) || byProgress(a, b),
  THREAT: (a, b) => compareThreat(a, b),
  WEAK_POINT: (a, b) => Number(isWeakPoint(b)) - Number(isWeakPoint(a)) || compareThreat(a, b),
};

/** Inimigos vivos, miráveis e dentro da forma de alcance. */
export function aliveInShape<T extends TargetCandidate>(
  candidates: readonly T[],
  origin: TargetOrigin,
  range: number,
  shape: TargetingShape = RADIAL,
  now = 0,
): T[] {
  return candidates.filter(
    (candidate) =>
      !candidate.dead && !candidate.reachedGoal && (candidate.isTargetable?.(now) ?? true) && shapeContains(shape, origin, range, candidate),
  );
}

/** Compatibilidade: alcance radial simples. */
export function aliveInRange<T extends TargetCandidate>(candidates: readonly T[], origin: Vec2, range: number): T[] {
  return aliveInShape(candidates, origin, range, RADIAL);
}

/** Melhor alvo segundo a política. Nunca devolve algo fora do alcance. */
export function selectTarget<T extends TargetCandidate>(
  candidates: readonly T[],
  origin: TargetOrigin,
  range: number,
  policy: TargetPolicy,
  now = 0,
): T | undefined {
  const pool = aliveInShape(candidates, origin, range, policy.shape ?? RADIAL, now);
  if (pool.length === 0) return undefined;
  if (policy.preferredId) {
    const preferred = pool.find((candidate) => candidate.id === policy.preferredId);
    if (preferred) return preferred;
  }
  if (policy.markedId) {
    const marked = pool.find((candidate) => candidate.id === policy.markedId);
    if (marked) return marked;
  }
  const context: CompareContext = { origin, threshold: policy.threshold ?? 0.4, now };
  const comparator = COMPARATORS[normalizeStrategy(policy.mode)] ?? COMPARATORS.FIRST;
  const priority = policy.priority;
  if (!priority) return [...pool].sort((a, b) => comparator(a, b, context))[0];
  // Ordena por categoria e só depois pelo comparador da estratégia. Categoria não listada vai para
  // o fim — nunca é filtrada, senão o Guardião ficaria sem alvo num campo só de categorias que ele
  // não prioriza.
  const rank = (candidate: T): number => {
    const index = priority.indexOf(tierOf(candidate));
    return index === -1 ? priority.length : index;
  };
  return [...pool].sort((a, b) => rank(a) - rank(b) || comparator(a, b, context))[0];
}

/** Maior ameaça ao alcance (para marcar presa e para o Sonar). */
export function selectThreat<T extends TargetCandidate>(candidates: readonly T[], origin: TargetOrigin, range: number, now = 0): T | undefined {
  return selectTarget(candidates, origin, range, { mode: "THREAT" }, now);
}
