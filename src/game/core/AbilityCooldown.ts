export class AbilityCooldown {
  private readyAt = 0;

  get nextReadyAt(): number {
    return this.readyAt;
  }

  isReady(now: number): boolean {
    return now >= this.readyAt;
  }

  tryActivate(now: number, cooldownMs: number): boolean {
    if (!this.isReady(now)) return false;
    this.readyAt = now + Math.max(0, cooldownMs);
    return true;
  }
}
