import type { ChorusEffect, GuardianId, Vec2 } from "../types";
import { AbilityCooldown } from "./AbilityCooldown";
import { scaleAura, type AuraSource } from "./Auras";

/**
 * Coro do Golfinho: buff temporizado que vira uma `AuraSource` só enquanto ativo. Quanto mais espécies
 * diferentes de Guardião na área, maior a eficiência (unidades repetidas não contam).
 */
export class ChorusState {
  private readonly cooldown = new AbilityCooldown();
  private activeUntil = 0;

  constructor(private config: ChorusEffect) {}

  setConfig(config: ChorusEffect): void {
    this.config = config;
  }

  get effect(): ChorusEffect {
    return this.config;
  }

  radius(range: number): number {
    return range * this.config.radiusMultiplier;
  }

  /** Tenta iniciar um chamado quando há aliados; devolve true no instante em que começa. */
  update(now: number, alliesInRange: number, cooldownMultiplier = 1): boolean {
    if (alliesInRange <= 0 || this.isActive(now)) return false;
    if (!this.cooldown.tryActivate(now, this.config.cooldownMs * cooldownMultiplier)) return false;
    this.activeUntil = now + this.config.durationMs;
    return true;
  }

  isActive(now: number): boolean {
    return now < this.activeUntil;
  }

  remainingMs(now: number): number {
    return Math.max(0, this.activeUntil - now);
  }

  efficiency(distinctSpecies: number): number {
    return 1 + this.config.speciesBonus * Math.max(0, Math.min(this.config.maxSpecies, distinctSpecies));
  }

  /** Fonte de aura para os aliados na área, ou null quando o coro está em silêncio. */
  asAuraSource(owner: Vec2 & { id: string }, range: number, distinctSpecies: number, now: number): AuraSource | null {
    if (!this.isActive(now)) return null;
    const efficiency = this.efficiency(distinctSpecies);
    return {
      id: owner.id,
      x: owner.x,
      y: owner.y,
      range: this.radius(range),
      aura: scaleAura(this.config.aura, efficiency),
      thematic: this.config.thematic,
    };
  }
}

/** Espécies distintas de Guardião ao alcance, sem contar a própria fonte. */
export function distinctSpeciesInRange(
  owner: Vec2 & { id: string },
  radius: number,
  guardians: ReadonlyArray<Vec2 & { id: string; guardianId: GuardianId }>,
): number {
  const species = new Set<GuardianId>();
  for (const guardian of guardians) {
    if (guardian.id === owner.id) continue;
    if (Math.hypot(guardian.x - owner.x, guardian.y - owner.y) > radius) continue;
    species.add(guardian.guardianId);
  }
  return species.size;
}
