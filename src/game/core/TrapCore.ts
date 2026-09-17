import type { TrapEffect } from "../types";

export type TrapPhase = "arming" | "armed" | "triggered" | "cooldown";

export type TrapEvent = { type: "trigger"; chargeBonus: number } | { type: "phase"; phase: TrapPhase };

/** Quanto tempo o Peixe-Pedra fica emergido após disparar (visual). */
export const TRAP_TRIGGER_MS = 450;

/**
 * Máquina de estados da armadilha do Peixe-Pedra, sem Phaser:
 * arming (exposto, enterrando) → armed → triggered (emergido) → cooldown → arming.
 *
 * Com `exitTrigger` (o padrão do Peixe-Pedra desde a V3.1), ela NÃO dispara no primeiro contato: segura
 * o tiro enquanto o grupo se forma e solta quando alguém está prestes a escapar do raio (`leaving`) —
 * o instante em que há mais gente dentro. `maxHoldMs` é a rede de segurança para a fila que não anda.
 * Sem `exitTrigger`, volta ao comportamento simples: dispara assim que há qualquer inimigo no raio.
 *
 * Quanto mais tempo armada sem disparar, maior o bônus (`charge`), até o teto.
 */
export class TrapCore {
  private currentPhase: TrapPhase = "arming";
  private phaseUntil: number;
  private armedSince = 0;
  private firstSeenAt: number | null = null;

  constructor(
    private config: TrapEffect,
    now = 0,
  ) {
    this.phaseUntil = now + config.armMs;
  }

  get phase(): TrapPhase {
    return this.currentPhase;
  }

  get phaseEndsAt(): number {
    return this.phaseUntil;
  }

  /** Upgrade comprado: novos tempos, mesma fase. */
  setConfig(config: TrapEffect): void {
    this.config = config;
  }

  /** Bônus acumulado se disparasse agora. */
  chargeBonus(now: number): number {
    if (this.currentPhase !== "armed") return 0;
    const steps = Math.floor(Math.max(0, now - this.armedSince) / this.config.charge.everyMs);
    return Math.min(this.config.charge.max, steps * this.config.charge.bonus);
  }

  /**
   * `leaving`: algum inimigo dentro do raio está a ponto de sair. Quem calcula é o comportamento, que
   * é quem enxerga as posições; a máquina de estados só decide o que fazer com a informação.
   */
  update(now: number, enemiesInRadius: number, options: { leaving?: boolean; rearmMultiplier?: number } = {}): TrapEvent[] {
    const rearmMultiplier = options.rearmMultiplier ?? 1;
    const events: TrapEvent[] = [];
    switch (this.currentPhase) {
      case "arming":
        if (now >= this.phaseUntil) {
          this.armedSince = now;
          this.firstSeenAt = null;
          events.push(this.enter("armed", Number.POSITIVE_INFINITY));
        }
        break;
      case "armed":
        if (enemiesInRadius <= 0) {
          this.firstSeenAt = null;
          break;
        }
        if (this.config.exitTrigger) {
          if (this.firstSeenAt === null) this.firstSeenAt = now;
          const held = now - this.firstSeenAt;
          // Segura enquanto ninguém está saindo E a rede de segurança não estourou.
          if (!options.leaving && held < this.config.exitTrigger.maxHoldMs) break;
        }
        events.push({ type: "trigger", chargeBonus: this.chargeBonus(now) });
        events.push(this.enter("triggered", now + TRAP_TRIGGER_MS));
        break;
      case "triggered":
        if (now >= this.phaseUntil) events.push(this.enter("cooldown", now + this.config.cooldownMs * rearmMultiplier));
        break;
      case "cooldown":
        if (now >= this.phaseUntil) events.push(this.enter("arming", now + this.config.armMs));
        break;
    }
    return events;
  }

  private enter(phase: TrapPhase, until: number): TrapEvent {
    this.currentPhase = phase;
    this.phaseUntil = until;
    return { type: "phase", phase };
  }
}

/** Multiplicadores de dano e de controle a partir do bônus de carga (só um dos dois cresce). */
export function trapChargeMultipliers(config: TrapEffect, chargeBonus: number): { damage: number; control: number } {
  return {
    damage: config.charge.applyTo === "damage" ? 1 + chargeBonus : 1,
    control: config.charge.applyTo === "control" ? 1 + chargeBonus : 1,
  };
}
