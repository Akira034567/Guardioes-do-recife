export type MatchSpeed = 1 | 2 | 3;

/**
 * Acumulador de passo fixo que liga o tempo real (frames do Phaser) ao tempo da partida. Velocidade e
 * pausa vivem aqui, fora do motor: 2× é simplesmente rodar dois ticks por frame. Assim a simulação
 * headless, o jogo e um futuro lockstep compartilham o mesmo motor sem noção de relógio de parede.
 */
export class MatchClock {
  speed: MatchSpeed = 1;
  paused = false;
  private accumulatorMs = 0;

  constructor(
    readonly dtMs = 1000 / 60,
    private readonly maxTicksPerFrame = 6,
    private readonly maxFrameMs = 100,
  ) {}

  /** Avança o relógio com o delta real e roda os ticks devidos. Devolve quantos ticks rodaram. */
  advance(realDeltaMs: number, tick: () => void): number {
    if (this.paused) return 0;
    this.accumulatorMs += Math.max(0, Math.min(this.maxFrameMs, realDeltaMs)) * this.speed;
    let ticks = 0;
    while (this.accumulatorMs >= this.dtMs && ticks < this.maxTicksPerFrame) {
      this.accumulatorMs -= this.dtMs;
      tick();
      ticks += 1;
    }
    // Quadros muito longos (aba em segundo plano): descarta o excesso para não travar em cascata.
    if (this.accumulatorMs >= this.dtMs) this.accumulatorMs = 0;
    return ticks;
  }

  reset(): void {
    this.accumulatorMs = 0;
  }
}
