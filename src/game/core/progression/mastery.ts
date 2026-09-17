import { MASTERY, MASTERY_MAX_LEVEL, type MasteryEffect } from "../../data/mastery";
import type { GuardianId } from "../../types";

/**
 * Bônus permanente que um Guardião leva para dentro da partida. É a soma dos nós de maestria já
 * comprados, resolvida FORA da partida e entregue pronta ao motor — `Match` não conhece save nem
 * Conchas, do mesmo jeito que não conhece dificuldade.
 */
export interface MasteryBonus {
  damageMultiplier: number;
  attackSpeedMultiplier: number;
  rangeMultiplier: number;
  projectileSpeedMultiplier: number;
  controlDurationMultiplier: number;
  debuffDurationMultiplier: number;
  abilityCooldownMultiplier: number;
  rearmMultiplier: number;
  contactDamageMultiplier: number;
  trapArmMultiplier: number;
  chargeMaxBonus: number;
  pushDistanceMultiplier: number;
  /** Vagas de bloqueio a mais (aditivo). Hoje só a coroa do Peixinho usa. */
  blockCapacityBonus: number;
  /**
   * Nó 5 disponível para esta unidade. Vira `null` enquanto ela não chegar ao nível 2 de um ramo.
   *
   * 🔶 PONTO DE EXTENSÃO: hoje nenhum sistema lê este campo. Quando os efeitos temáticos forem
   * definidos, é por aqui que eles entram — o id identifica o efeito e `branchId` diz qual metade
   * dele vale. Até lá, o campo existe para a interface poder mostrar "ativo" e para os testes
   * congelarem a regra de ativação.
   */
  capstone: { id: string; branchId: "a" | "b" } | null;
}

export const NEUTRAL_MASTERY: MasteryBonus = {
  damageMultiplier: 1,
  attackSpeedMultiplier: 1,
  rangeMultiplier: 1,
  projectileSpeedMultiplier: 1,
  controlDurationMultiplier: 1,
  debuffDurationMultiplier: 1,
  abilityCooldownMultiplier: 1,
  rearmMultiplier: 1,
  contactDamageMultiplier: 1,
  trapArmMultiplier: 1,
  chargeMaxBonus: 0,
  pushDistanceMultiplier: 1,
  blockCapacityBonus: 0,
  capstone: null,
};

const MULTIPLIERS = [
  "damageMultiplier",
  "attackSpeedMultiplier",
  "rangeMultiplier",
  "projectileSpeedMultiplier",
  "controlDurationMultiplier",
  "debuffDurationMultiplier",
  "abilityCooldownMultiplier",
  "rearmMultiplier",
  "contactDamageMultiplier",
  "trapArmMultiplier",
  "pushDistanceMultiplier",
] as const satisfies ReadonlyArray<keyof MasteryEffect & keyof MasteryBonus>;

/** Nível saneado: inteiro entre 0 e o teto da árvore. */
export function masteryLevelOf(levels: Partial<Record<GuardianId, number>> | undefined, guardianId: GuardianId): number {
  const raw = levels?.[guardianId] ?? 0;
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(MASTERY_MAX_LEVEL, Math.floor(raw)));
}

/**
 * Soma os nós comprados. Os quatro primeiros são numéricos e MULTIPLICAM entre si (cada um é pequeno,
 * então a composição continua pequena); o quinto não tem número: só acende o `capstone`, e mesmo assim
 * apenas quando a unidade chegou ao nível 2 de um ramo.
 */
export function resolveMastery(
  guardianId: GuardianId,
  level: number,
  branch: { branchId: "a" | "b" | null; upgradeLevel: number } = { branchId: null, upgradeLevel: 0 },
): MasteryBonus {
  const clamped = Math.max(0, Math.min(MASTERY_MAX_LEVEL, Math.floor(level)));
  if (clamped <= 0) return NEUTRAL_MASTERY;
  const tree = MASTERY[guardianId];
  const bonus: MasteryBonus = { ...NEUTRAL_MASTERY };
  for (const item of tree.nodes) {
    if (item.level > clamped) continue;
    for (const key of MULTIPLIERS) {
      const value = item.effect[key];
      if (value !== undefined) bonus[key] *= value;
    }
    bonus.chargeMaxBonus += item.effect.chargeMaxBonus ?? 0;
  }
  const capstoneReady = clamped >= MASTERY_MAX_LEVEL && branch.branchId !== null && branch.upgradeLevel >= 2;
  bonus.capstone = capstoneReady ? { id: tree.capstone.id, branchId: branch.branchId as "a" | "b" } : null;
  return bonus;
}

/**
 * Junta dois pacotes de bônus PERMANENTES/da partida: multiplica o que é multiplicador e soma o que
 * é aditivo. Serve para a maestria (permanente) conviver com a coroa do Peixinho (de uma partida) sem
 * que um sobrescreva o outro — são fontes separadas, e cada uma soma a sua parte.
 */
export function combineBonus(base: MasteryBonus, extra: Partial<MasteryBonus> | null): MasteryBonus {
  if (!extra) return base;
  const result: MasteryBonus = { ...base };
  for (const key of MULTIPLIERS) {
    const value = extra[key];
    if (value !== undefined) result[key] *= value;
  }
  result.chargeMaxBonus += extra.chargeMaxBonus ?? 0;
  result.blockCapacityBonus += extra.blockCapacityBonus ?? 0;
  return result;
}

/** Ganho efetivo aproximado dos nós numéricos, para a interface mostrar "+13%" sem inventar conta. */
export function masteryPowerPercent(guardianId: GuardianId, level: number): number {
  const bonus = resolveMastery(guardianId, level);
  // Cada multiplicador "maior é melhor" entra pelo que passa de 1; recarga e rearme, pelo que falta.
  const gains = [
    bonus.damageMultiplier - 1,
    bonus.attackSpeedMultiplier - 1,
    bonus.rangeMultiplier - 1,
    bonus.projectileSpeedMultiplier - 1,
    bonus.controlDurationMultiplier - 1,
    bonus.debuffDurationMultiplier - 1,
    bonus.contactDamageMultiplier - 1,
    bonus.pushDistanceMultiplier - 1,
    1 - bonus.abilityCooldownMultiplier,
    1 - bonus.rearmMultiplier,
    1 - bonus.trapArmMultiplier,
    bonus.chargeMaxBonus,
  ];
  return Math.round(gains.reduce((total, value) => total + Math.max(0, value), 0) * 100);
}
