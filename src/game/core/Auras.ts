import type { AuraEffect, GuardianId, ResolvedAura, Vec2 } from "../types";

export const AURA_KEYS: readonly (keyof ResolvedAura)[] = [
  "attackSpeedMultiplier",
  "rangeMultiplier",
  "abilityCooldownMultiplier",
  "damageMultiplier",
  "controlDurationMultiplier",
  "debuffDurationMultiplier",
  "projectileSpeedMultiplier",
  "rearmMultiplier",
  "dashSpeedMultiplier",
];

/** Multiplicadores em que "menor" é melhor (recargas). */
const LOWER_IS_BETTER: ReadonlySet<keyof ResolvedAura> = new Set(["abilityCooldownMultiplier", "rearmMultiplier"]);

export const NEUTRAL_AURA: ResolvedAura = {
  attackSpeedMultiplier: 1,
  rangeMultiplier: 1,
  abilityCooldownMultiplier: 1,
  damageMultiplier: 1,
  controlDurationMultiplier: 1,
  debuffDurationMultiplier: 1,
  projectileSpeedMultiplier: 1,
  rearmMultiplier: 1,
  dashSpeedMultiplier: 1,
};

export interface AuraSource extends Vec2 {
  id: string;
  range: number;
  aura: AuraEffect;
  /** Bônus extra por espécie do alvo (Coro II). */
  thematic?: Partial<Record<GuardianId, AuraEffect>>;
}

export interface AuraTarget extends Vec2 {
  id: string;
  guardianId?: GuardianId;
}

/** Preenche os campos ausentes com o valor neutro. */
export function completeAura(aura: AuraEffect): ResolvedAura {
  const result = { ...NEUTRAL_AURA };
  for (const key of AURA_KEYS) {
    const value = aura[key];
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/** Combina dois efeitos multiplicando as partes (para eficiência do Coro e bônus temáticos). */
export function combineAura(base: AuraEffect, extra: AuraEffect): AuraEffect {
  const result: AuraEffect = { ...base };
  for (const key of AURA_KEYS) {
    const value = extra[key];
    if (value === undefined) continue;
    result[key] = (result[key] ?? 1) * value;
  }
  return result;
}

/** Escala a parte que passa de 1 (ou que falta para 1, nas recargas) por `efficiency`. */
export function scaleAura(aura: AuraEffect, efficiency: number): AuraEffect {
  const result: AuraEffect = {};
  for (const key of AURA_KEYS) {
    const value = aura[key];
    if (value === undefined) continue;
    result[key] = 1 + (value - 1) * efficiency;
  }
  return result;
}

function better(key: keyof ResolvedAura, current: number, candidate: number): number {
  return LOWER_IS_BETTER.has(key) ? Math.min(current, candidate) : Math.max(current, candidate);
}

/**
 * Buffs não acumulam: para cada atributo vale o melhor valor entre as fontes ao
 * alcance. A própria fonte nunca se beneficia (excluída por id).
 */
export function resolveAura(target: AuraTarget, sources: readonly AuraSource[]): ResolvedAura {
  const result = { ...NEUTRAL_AURA };
  for (const source of sources) {
    if (source.id === target.id) continue;
    if (Math.hypot(source.x - target.x, source.y - target.y) > source.range) continue;
    const thematic = target.guardianId ? source.thematic?.[target.guardianId] : undefined;
    const effect = thematic ? combineAura(source.aura, thematic) : source.aura;
    for (const key of AURA_KEYS) {
      const value = effect[key];
      if (value !== undefined) result[key] = better(key, result[key], value);
    }
  }
  return result;
}

export function sameAura(first: AuraEffect, second: AuraEffect): boolean {
  return AURA_KEYS.every((key) => Math.abs((first[key] ?? 1) - (second[key] ?? 1)) < 1e-6);
}
