import type { AuraEffect, Vec2 } from "../types";

export interface AuraSource extends Vec2 {
  id: string;
  range: number;
  aura: AuraEffect;
}

export const NEUTRAL_AURA: AuraEffect = { attackSpeedMultiplier: 1, rangeMultiplier: 1 };

/**
 * Buffs não acumulam: para cada atributo vale o melhor valor entre as fontes ao
 * alcance. A própria fonte nunca se beneficia (excluída por id).
 */
export function resolveAura(target: Vec2 & { id: string }, sources: readonly AuraSource[]): AuraEffect {
  let attackSpeedMultiplier = 1;
  let rangeMultiplier = 1;
  for (const source of sources) {
    if (source.id === target.id) continue;
    if (Math.hypot(source.x - target.x, source.y - target.y) > source.range) continue;
    attackSpeedMultiplier = Math.max(attackSpeedMultiplier, source.aura.attackSpeedMultiplier);
    rangeMultiplier = Math.max(rangeMultiplier, source.aura.rangeMultiplier);
  }
  return { attackSpeedMultiplier, rangeMultiplier };
}

export function sameAura(first: AuraEffect, second: AuraEffect): boolean {
  return (
    Math.abs(first.attackSpeedMultiplier - second.attackSpeedMultiplier) < 1e-6 &&
    Math.abs(first.rangeMultiplier - second.rangeMultiplier) < 1e-6
  );
}
