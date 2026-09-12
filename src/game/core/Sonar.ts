import type { SonarEffect } from "../types";
import { AbilityCooldown } from "./AbilityCooldown";

/**
 * Uma onda do sonar. Sem `echo`, a única onda faz tudo (menos coordenar). Com Eco Perfeito:
 * onda 0 localiza (revela), onda 1 analisa (vulnerabilidade e prioridade) e onda 2 coordena.
 */
export interface SonarWave {
  index: number;
  total: number;
  reveal: boolean;
  vulnerability: boolean;
  priority: boolean;
  coordinate: boolean;
}

/**
 * Pulso de ecolocalização do Golfinho, sem Phaser. Agenda as ondas; quem aplica os efeitos nos inimigos e
 * a coordenação nos Guardiões é o runtime (cena ou simulação).
 */
export class SonarCore {
  private readonly cooldown = new AbilityCooldown();
  private pending: Array<{ at: number; index: number }> = [];

  constructor(private config: SonarEffect) {}

  setConfig(config: SonarEffect): void {
    this.config = config;
  }

  get effect(): SonarEffect {
    return this.config;
  }

  radius(range: number): number {
    return range * this.config.radiusMultiplier;
  }

  /** Tenta iniciar um pulso quando há inimigos; devolve as ondas cujo instante já chegou. */
  update(now: number, enemiesInRange: number, cooldownMultiplier = 1): SonarWave[] {
    if (this.pending.length === 0 && enemiesInRange > 0 && this.cooldown.tryActivate(now, this.config.cooldownMs * cooldownMultiplier)) {
      const waves = Math.max(1, this.config.echo?.waves ?? 1);
      const interval = this.config.echo?.intervalMs ?? 0;
      for (let index = 0; index < waves; index += 1) this.pending.push({ at: now + index * interval, index });
    }
    const due: SonarWave[] = [];
    while (this.pending.length > 0 && this.pending[0].at <= now) {
      const wave = this.pending.shift() as { at: number; index: number };
      due.push(this.describe(wave.index));
    }
    return due;
  }

  private describe(index: number): SonarWave {
    const total = Math.max(1, this.config.echo?.waves ?? 1);
    if (total === 1) {
      return { index, total, reveal: true, vulnerability: true, priority: Boolean(this.config.markPriority), coordinate: false };
    }
    return {
      index,
      total,
      reveal: index === 0,
      vulnerability: index === 1,
      priority: index === 1 && Boolean(this.config.markPriority),
      coordinate: index === total - 1,
    };
  }
}
