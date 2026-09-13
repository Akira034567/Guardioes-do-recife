import type { GuardianUnlockDefinition, UnlockCondition } from "../../data/unlocks";
import type { GuardianId } from "../../types";
import type { PlayerProgress } from "../save/PlayerProgress";
import { totalStars } from "./stars";

export type UnlockState = "locked" | "available" | "unlocked";

export interface UnlockProgress {
  current: number;
  target: number;
  label: string;
}

export interface UnlockStatus {
  guardianId: GuardianId;
  state: UnlockState;
  /** Progresso da condição mais adiantada, para a barra da coleção. */
  progress: UnlockProgress | null;
  /** Preço em Conchas quando existe uma condição de compra; null quando não há. */
  price: number | null;
  /** Card em silhueta com "???" até o jogador ter alguma pista. */
  hidden: boolean;
  hint: string;
}

/** Quanto falta para cada tipo de condição, em números que servem para uma barra. */
const PROGRESS: Record<UnlockCondition["type"], (condition: UnlockCondition, progress: PlayerProgress) => UnlockProgress> = {
  default: () => ({ current: 1, target: 1, label: "Disponível desde o começo" }),
  levelCompleted: (condition, progress) => {
    const levelId = (condition as Extract<UnlockCondition, { type: "levelCompleted" }>).levelId;
    return { current: progress.completedLevels.includes(levelId) ? 1 : 0, target: 1, label: `Conclua ${levelId}` };
  },
  bossDefeated: (condition, progress) => {
    const enemyId = (condition as Extract<UnlockCondition, { type: "bossDefeated" }>).enemyId;
    return { current: progress.enemyDiscovery[enemyId]?.kills ?? 0, target: 1, label: "Derrote o chefe" };
  },
  starsTotal: (condition, progress) => {
    const stars = (condition as Extract<UnlockCondition, { type: "starsTotal" }>).stars;
    return { current: totalStars(progress.levelStars), target: stars, label: `${stars} estrelas` };
  },
  secretFound: (condition, progress) => {
    const secretId = (condition as Extract<UnlockCondition, { type: "secretFound" }>).secretId;
    return { current: progress.discoveredSecrets.includes(secretId) ? 1 : 0, target: 1, label: "Encontre o segredo" };
  },
  encounterCompleted: (condition, progress) => {
    const encounterId = (condition as Extract<UnlockCondition, { type: "encounterCompleted" }>).encounterId;
    return { current: progress.completedEncounters.includes(encounterId) ? 1 : 0, target: 1, label: "Conclua o Encontro" };
  },
  achievement: (condition, progress) => {
    const achievementId = (condition as Extract<UnlockCondition, { type: "achievement" }>).achievementId;
    return { current: progress.achievements[achievementId]?.unlockedAt ? 1 : 0, target: 1, label: "Conquista" };
  },
  guardiansUnlocked: (condition, progress) => {
    const count = (condition as Extract<UnlockCondition, { type: "guardiansUnlocked" }>).count;
    return { current: progress.unlockedGuardians.length, target: count, label: `${count} Guardiões no Recife` };
  },
  levelsCompleted: (condition, progress) => {
    const count = (condition as Extract<UnlockCondition, { type: "levelsCompleted" }>).count;
    return { current: progress.completedLevels.length, target: count, label: `${count} fases concluídas` };
  },
  purchase: (condition, progress) => {
    const shells = (condition as Extract<UnlockCondition, { type: "purchase" }>).shells;
    return { current: progress.currency.shells, target: shells, label: `${shells} Conchas` };
  },
};

export function isSatisfied(condition: UnlockCondition, progress: PlayerProgress): boolean {
  // A compra nunca se satisfaz sozinha: ela depende do jogador gastar as Conchas.
  if (condition.type === "purchase") return false;
  const status = PROGRESS[condition.type](condition, progress);
  return status.current >= status.target;
}

/** Estado de um Guardião na coleção e o quanto falta para tirá-lo do "???". */
export function unlockStatus(definition: GuardianUnlockDefinition, progress: PlayerProgress): UnlockStatus {
  const unlocked = progress.unlockedGuardians.includes(definition.guardianId);
  const purchase = definition.conditions.find((condition) => condition.type === "purchase");
  const price = purchase ? (purchase as Extract<UnlockCondition, { type: "purchase" }>).shells : null;
  const candidates = definition.conditions.filter((condition) => condition.type !== "purchase").map((condition) => PROGRESS[condition.type](condition, progress));
  // A condição mais adiantada é a que o jogador enxerga.
  const best = candidates.sort((a, b) => b.current / Math.max(1, b.target) - a.current / Math.max(1, a.target))[0] ?? null;
  const affordable = price !== null && progress.currency.shells >= price;
  return {
    guardianId: definition.guardianId,
    state: unlocked ? "unlocked" : affordable ? "available" : "locked",
    progress: best,
    price,
    hidden: Boolean(definition.hidden) && !unlocked && (best?.current ?? 0) === 0 && !(definition.revealWhen ?? []).some((condition) => isSatisfied(condition, progress)),
    hint: definition.reveal.hint,
  };
}

/** Desbloqueia tudo que as condições já permitem. Devolve só os Guardiões novos. */
export function reconcileUnlocks(definitions: readonly GuardianUnlockDefinition[], progress: PlayerProgress): GuardianId[] {
  const unlocked: GuardianId[] = [];
  for (const definition of definitions) {
    if (progress.unlockedGuardians.includes(definition.guardianId)) continue;
    if (!definition.conditions.some((condition) => isSatisfied(condition, progress))) continue;
    progress.unlockedGuardians.push(definition.guardianId);
    unlocked.push(definition.guardianId);
  }
  return unlocked;
}

export type PurchaseResult = { ok: true } | { ok: false; reason: "notFound" | "alreadyUnlocked" | "notForSale" | "insufficientShells" };

/** Compra um Guardião com a moeda global (o caminho alternativo ao Encontro). */
export function purchaseUnlock(definitions: readonly GuardianUnlockDefinition[], progress: PlayerProgress, guardianId: GuardianId): PurchaseResult {
  const definition = definitions.find((candidate) => candidate.guardianId === guardianId);
  if (!definition) return { ok: false, reason: "notFound" };
  if (progress.unlockedGuardians.includes(guardianId)) return { ok: false, reason: "alreadyUnlocked" };
  const purchase = definition.conditions.find((condition) => condition.type === "purchase");
  if (!purchase) return { ok: false, reason: "notForSale" };
  const price = (purchase as Extract<UnlockCondition, { type: "purchase" }>).shells;
  if (progress.currency.shells < price) return { ok: false, reason: "insufficientShells" };
  progress.currency.shells -= price;
  progress.unlockedGuardians.push(guardianId);
  return { ok: true };
}
