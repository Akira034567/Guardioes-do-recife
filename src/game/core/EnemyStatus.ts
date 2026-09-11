/**
 * Efeitos de estado de um inimigo, sem dependência de Phaser.
 * Regras anti-abuso:
 *  - lentidão: vale o fator mais forte ativo; resistência reduz o efeito;
 *  - paralisia e pausa de chefe: após o efeito, o inimigo fica imune por um período;
 *  - vulnerabilidade: não acumula, vale o maior multiplicador ativo.
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

  constructor(private readonly slowResistance = 0) {}

  update(now: number): void {
    if (now >= this.slowUntil) this.slowFactorValue = 1;
    if (now >= this.vulnerabilityUntil) this.vulnerabilityValue = 1;
  }

  applySlow(factor: number, durationMs: number, now: number): void {
    const resisted = 1 - (1 - Math.max(0.2, factor)) * (1 - Math.max(0, Math.min(1, this.slowResistance)));
    if (now >= this.slowUntil) this.slowFactorValue = 1;
    this.slowFactorValue = Math.min(this.slowFactorValue, resisted);
    this.slowUntil = Math.max(this.slowUntil, now + durationMs);
  }

  tryStun(durationMs: number, immunityMs: number, now: number): boolean {
    if (now < this.stunImmuneUntil || this.isStunned(now)) return false;
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

  applyVulnerability(multiplier: number, durationMs: number, now: number): void {
    if (now >= this.vulnerabilityUntil) this.vulnerabilityValue = 1;
    this.vulnerabilityValue = Math.max(this.vulnerabilityValue, Math.max(1, multiplier));
    this.vulnerabilityUntil = Math.max(this.vulnerabilityUntil, now + durationMs);
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

  slowFactor(now: number): number {
    return now >= this.slowUntil ? 1 : this.slowFactorValue;
  }

  speedMultiplier(now: number): number {
    if (this.isStunned(now) || this.isHeld(now)) return 0;
    return this.slowFactor(now);
  }

  damageMultiplier(now: number): number {
    return now >= this.vulnerabilityUntil ? 1 : this.vulnerabilityValue;
  }
}
