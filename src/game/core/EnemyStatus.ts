import type { ControlResistance, ControlTier, PoisonEffect } from "../types";
import { StatusContainer, type StatusType } from "./StatusEffects";

/** Resistências por tipo de status (0..1 = fração ignorada). `slow` substitui o antigo `slowResistance`. */
export type StatusResistances = Partial<Record<StatusType, number>>;

/**
 * Fachada dos efeitos de status de um inimigo sobre o `StatusContainer` central. Mantém a API e as
 * regras anti-abuso originais:
 *  - lentidão: vale o fator mais forte ativo; resistência reduz o efeito;
 *  - paralisia e pausa de chefe: podem impor imunidade após o efeito (Água-viva, Baiacu);
 *  - controles fortes (stun, bloqueio temporário, knockback) de elites/chefes passam por
 *    retornos decrescentes (`controlScale`) configurados em `CROWD_CONTROL`;
 *  - vulnerabilidade: não acumula, vale o maior multiplicador ativo;
 *  - veneno: acumula até um teto e o dano é drenado pelo runtime (`drainPoison`);
 *  - marca: bônus de dano só para a fonte que marcou.
 */
export class EnemyStatus {
  readonly container: StatusContainer;
  private readonly resistances: StatusResistances;
  private readonly controlHistory: number[] = [];
  private controlImmuneUntil = 0;

  constructor(slowResistance = 0, resistances: StatusResistances = {}, immunities: ReadonlySet<StatusType> = new Set()) {
    this.resistances = { slow: slowResistance, ...resistances };
    this.container = new StatusContainer("enemy", immunities);
  }

  /** Fração ignorada de um tipo de status (0..1). */
  resistance(type: StatusType): number {
    return Math.max(0, Math.min(1, this.resistances[type] ?? 0));
  }

  update(now: number): void {
    this.container.update(now);
  }

  // ------------------------------------------------------------------ slow

  applySlow(factor: number, durationMs: number, now: number): void {
    const resisted = 1 - (1 - Math.max(0.2, factor)) * (1 - this.resistance("slow"));
    this.container.apply({ type: "slow", strength: resisted, durationMs }, now);
  }

  slowFactor(now: number): number {
    return this.container.strength("slow", now) ?? 1;
  }

  // ------------------------------------------------------- stun / hold

  /**
   * Paralisa. `immunityMs` > 0 impede novas paralisias por esse tempo (regra da Água-viva);
   * com 0, a repetição fica a cargo de `controlScale`.
   */
  tryStun(durationMs: number, immunityMs: number, now: number): boolean {
    return this.container.apply({ type: "stun", strength: 1, durationMs, immunityMs }, now) === "applied";
  }

  tryHold(durationMs: number, immunityMs: number, now: number): boolean {
    return this.container.apply({ type: "hold", strength: 1, durationMs, immunityMs }, now) === "applied";
  }

  isStunned(now: number): boolean {
    return this.container.has("stun", now);
  }

  isHeld(now: number): boolean {
    return this.container.has("hold", now);
  }

  isStunImmune(now: number): boolean {
    return this.container.isImmune("stun", now);
  }

  isRooted(now: number): boolean {
    return this.container.has("root", now);
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
    this.container.apply({ type: "vulnerability", strength: Math.max(1, multiplier), durationMs }, now);
  }

  damageMultiplier(now: number): number {
    return this.container.strength("vulnerability", now) ?? 1;
  }

  // ------------------------------------------------------------------ marca

  /** Marca por uma fonte; uma marca nova substitui a anterior. */
  applyMark(sourceId: string, multiplier: number, durationMs: number, now: number): void {
    this.container.apply({ type: "mark", strength: Math.max(1, multiplier), durationMs, sourceId, stackBehavior: "REPLACE" }, now);
  }

  /** Reforça a marca ativa da mesma fonte (Alfa II). Sem marca ativa, não faz nada. */
  boostMark(sourceId: string, multiplier: number, now: number): void {
    this.container.boost("mark", sourceId, Math.max(1, multiplier), now);
  }

  clearMark(): void {
    this.container.remove("mark");
  }

  isMarked(now: number): boolean {
    return this.container.has("mark", now);
  }

  markedBy(now: number): string | null {
    return this.container.sourceOf("mark", now);
  }

  /** Multiplicador de dano para a fonte indicada (1 para todo mundo mais). */
  markMultiplier(sourceId: string | undefined, now: number): number {
    if (!sourceId) return 1;
    return this.container.strength("mark", now, sourceId) ?? 1;
  }

  // -------------------------------------------------------- reveal / prioridade

  reveal(durationMs: number, now: number): void {
    this.container.apply({ type: "reveal", strength: 1, durationMs }, now);
  }

  flagPriority(durationMs: number, now: number): void {
    this.container.apply({ type: "priority", strength: 1, durationMs }, now);
  }

  isRevealed(now: number): boolean {
    return this.container.has("reveal", now);
  }

  isPriority(now: number): boolean {
    return this.container.has("priority", now);
  }

  // ----------------------------------------------------------------- veneno

  /** Aplica ou reforça o veneno: acumula até `maxStacks` e renova a duração. */
  applyPoison(effect: PoisonEffect, now: number, durationMultiplier = 1): void {
    this.container.apply(
      {
        type: "poison",
        strength: effect.damagePerTick,
        durationMs: effect.durationMs * durationMultiplier,
        maxStacks: effect.maxStacks,
        tickMs: effect.tickMs,
        stackBehavior: "STACK",
      },
      now,
    );
  }

  isPoisoned(now: number): boolean {
    return this.container.has("poison", now);
  }

  poisonStacks(now: number): number {
    return this.container.stacks("poison", now);
  }

  /** Dano de veneno acumulado desde a última drenagem; o runtime aplica como dano contínuo. */
  drainPoison(now: number): number {
    return this.container.drainTicks("poison", now);
  }

  // ------------------------------------------------------------ armadura / escudo

  /** Redução de armadura ativa (pontos), para inimigos blindados sob "quebra-casco" futuro. */
  armorBreak(now: number): number {
    return this.container.strength("armorBreak", now) ?? 0;
  }

  /** Fração de dano absorvida por um escudo aliado (0 = nenhum). */
  shield(now: number): number {
    return this.container.strength("shield", now) ?? 0;
  }

  // ------------------------------------------------------------ velocidade

  speedMultiplier(now: number): number {
    if (this.isStunned(now) || this.isHeld(now) || this.isRooted(now)) return 0;
    return this.slowFactor(now);
  }
}
