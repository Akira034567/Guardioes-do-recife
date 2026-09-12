import type { ControlResistance, ControlTier, PoisonEffect } from "../types";

interface MarkState {
  sourceId: string;
  multiplier: number;
  until: number;
}

interface PoisonState {
  damagePerTick: number;
  tickMs: number;
  stacks: number;
  until: number;
  nextTickAt: number;
}

/**
 * Efeitos de estado de um inimigo, sem dependência de Phaser.
 * Regras anti-abuso:
 *  - lentidão: vale o fator mais forte ativo; resistência reduz o efeito;
 *  - paralisia e pausa de chefe: podem impor imunidade após o efeito (Água-viva, Baiacu);
 *  - controles fortes (stun, bloqueio temporário, knockback) de elites/chefes passam por
 *    retornos decrescentes (`controlScale`) configurados em `CROWD_CONTROL`;
 *  - vulnerabilidade: não acumula, vale o maior multiplicador ativo;
 *  - veneno: acumula até um teto e o dano é drenado pelo runtime (`drainPoison`);
 *  - marca: bônus de dano só para a fonte que marcou.
 */
export class EnemyStatus {
  private slowFactorValue = 1;
  private slowUntil = 0;
  private stunUntil = 0;
  private stunImmuneUntil = 0;
  private holdUntil = 0;
  private holdImmuneUntil = 0;
  private vulnerabilityValue = 1;
  private vulnerabilityUntil = 0;
  private revealedUntil = 0;
  private priorityUntil = 0;
  private mark: MarkState | null = null;
  private poison: PoisonState | null = null;
  private readonly controlHistory: number[] = [];
  private controlImmuneUntil = 0;

  constructor(private readonly slowResistance = 0) {}

  update(now: number): void {
    if (now >= this.slowUntil) this.slowFactorValue = 1;
    if (now >= this.vulnerabilityUntil) this.vulnerabilityValue = 1;
    if (this.mark && now >= this.mark.until) this.mark = null;
    if (this.poison && now >= this.poison.until && now >= this.poison.nextTickAt) this.poison = null;
  }

  // ------------------------------------------------------------------ slow

  applySlow(factor: number, durationMs: number, now: number): void {
    const resisted = 1 - (1 - Math.max(0.2, factor)) * (1 - Math.max(0, Math.min(1, this.slowResistance)));
    if (now >= this.slowUntil) this.slowFactorValue = 1;
    this.slowFactorValue = Math.min(this.slowFactorValue, resisted);
    this.slowUntil = Math.max(this.slowUntil, now + durationMs);
  }

  slowFactor(now: number): number {
    return now >= this.slowUntil ? 1 : this.slowFactorValue;
  }

  // ------------------------------------------------------- stun / hold

  /**
   * Paralisa. `immunityMs` > 0 impede novas paralisias por esse tempo (regra da Água-viva);
   * com 0, a repetição fica a cargo de `controlScale`.
   */
  tryStun(durationMs: number, immunityMs: number, now: number): boolean {
    if (now < this.stunImmuneUntil || this.isStunned(now)) return false;
    if (durationMs <= 0) return false;
    this.stunUntil = now + durationMs;
    this.stunImmuneUntil = this.stunUntil + immunityMs;
    return true;
  }

  tryHold(durationMs: number, immunityMs: number, now: number): boolean {
    if (now < this.holdImmuneUntil || this.isHeld(now)) return false;
    this.holdUntil = now + durationMs;
    this.holdImmuneUntil = this.holdUntil + immunityMs;
    return true;
  }

  isStunned(now: number): boolean {
    return now < this.stunUntil;
  }

  isHeld(now: number): boolean {
    return now < this.holdUntil;
  }

  isStunImmune(now: number): boolean {
    return now < this.stunImmuneUntil && !this.isStunned(now);
  }

  // ------------------------------------------------- resistência a controle

  /**
   * Fração do próximo controle forte que este inimigo sofre. Comuns: sempre 1. Elites/chefes: o
   * n-ésimo controle dentro da janela vale `steps[n]`; esgotados os passos, 0 até a imunidade passar.
   */
  controlScale(now: number, tier: ControlTier, resistance: ControlResistance | null): number {
    if (tier === "common" || !resistance) return 1;
    if (now < this.controlImmuneUntil) return 0;
    this.pruneControlHistory(now, resistance.windowMs);
    const index = this.controlHistory.length;
    if (index >= resistance.steps.length) return 0;
    return resistance.steps[index];
  }

  /** Registra um controle forte aplicado agora (chame só quando `controlScale` > 0 e o efeito valeu). */
  registerControl(now: number, tier: ControlTier, resistance: ControlResistance | null): void {
    if (tier === "common" || !resistance) return;
    this.pruneControlHistory(now, resistance.windowMs);
    this.controlHistory.push(now);
    if (this.controlHistory.length >= resistance.steps.length) {
      this.controlImmuneUntil = now + resistance.immunityMs;
      this.controlHistory.length = 0;
    }
  }

  isControlImmune(now: number): boolean {
    return now < this.controlImmuneUntil;
  }

  private pruneControlHistory(now: number, windowMs: number): void {
    while (this.controlHistory.length > 0 && now - this.controlHistory[0] > windowMs) this.controlHistory.shift();
  }

  // -------------------------------------------------------- vulnerabilidade

  applyVulnerability(multiplier: number, durationMs: number, now: number): void {
    if (now >= this.vulnerabilityUntil) this.vulnerabilityValue = 1;
    this.vulnerabilityValue = Math.max(this.vulnerabilityValue, Math.max(1, multiplier));
    this.vulnerabilityUntil = Math.max(this.vulnerabilityUntil, now + durationMs);
  }

  damageMultiplier(now: number): number {
    return now >= this.vulnerabilityUntil ? 1 : this.vulnerabilityValue;
  }

  // ------------------------------------------------------------------ marca

  /** Marca por uma fonte; uma marca nova substitui a anterior. */
  applyMark(sourceId: string, multiplier: number, durationMs: number, now: number): void {
    this.mark = { sourceId, multiplier: Math.max(1, multiplier), until: now + durationMs };
  }

  /** Reforça a marca ativa da mesma fonte (Alfa II). Sem marca ativa, não faz nada. */
  boostMark(sourceId: string, multiplier: number, now: number): void {
    if (!this.mark || this.mark.sourceId !== sourceId || now >= this.mark.until) return;
    this.mark.multiplier = Math.max(1, multiplier);
  }

  clearMark(): void {
    this.mark = null;
  }

  isMarked(now: number): boolean {
    return this.mark !== null && now < this.mark.until;
  }

  markedBy(now: number): string | null {
    return this.isMarked(now) ? (this.mark as MarkState).sourceId : null;
  }

  /** Multiplicador de dano para a fonte indicada (1 para todo mundo mais). */
  markMultiplier(sourceId: string | undefined, now: number): number {
    if (!sourceId || !this.mark || now >= this.mark.until || this.mark.sourceId !== sourceId) return 1;
    return this.mark.multiplier;
  }

  // -------------------------------------------------------- reveal / prioridade

  reveal(durationMs: number, now: number): void {
    this.revealedUntil = Math.max(this.revealedUntil, now + durationMs);
  }

  flagPriority(durationMs: number, now: number): void {
    this.priorityUntil = Math.max(this.priorityUntil, now + durationMs);
  }

  isRevealed(now: number): boolean {
    return now < this.revealedUntil;
  }

  isPriority(now: number): boolean {
    return now < this.priorityUntil;
  }

  // ----------------------------------------------------------------- veneno

  /** Aplica ou reforça o veneno: acumula até `maxStacks` e renova a duração. */
  applyPoison(effect: PoisonEffect, now: number, durationMultiplier = 1): void {
    const until = now + effect.durationMs * durationMultiplier;
    if (!this.poison || now >= this.poison.until) {
      this.poison = { damagePerTick: effect.damagePerTick, tickMs: effect.tickMs, stacks: 1, until, nextTickAt: now + effect.tickMs };
      return;
    }
    this.poison.damagePerTick = Math.max(this.poison.damagePerTick, effect.damagePerTick);
    this.poison.tickMs = Math.min(this.poison.tickMs, effect.tickMs);
    this.poison.stacks = Math.min(effect.maxStacks, this.poison.stacks + 1);
    this.poison.until = Math.max(this.poison.until, until);
  }

  isPoisoned(now: number): boolean {
    return this.poison !== null && (now < this.poison.until || now < this.poison.nextTickAt);
  }

  poisonStacks(now: number): number {
    return this.isPoisoned(now) ? (this.poison as PoisonState).stacks : 0;
  }

  /** Dano de veneno acumulado desde a última drenagem; o runtime aplica como dano contínuo. */
  drainPoison(now: number): number {
    if (!this.poison) return 0;
    let owed = 0;
    while (this.poison.nextTickAt <= now && this.poison.nextTickAt <= this.poison.until) {
      owed += this.poison.damagePerTick * this.poison.stacks;
      this.poison.nextTickAt += this.poison.tickMs;
    }
    if (now >= this.poison.until && this.poison.nextTickAt > this.poison.until) this.poison = null;
    return owed;
  }

  // ------------------------------------------------------------ velocidade

  speedMultiplier(now: number): number {
    if (this.isStunned(now) || this.isHeld(now)) return 0;
    return this.slowFactor(now);
  }
}
