import { devAssert, lifecycleLog } from "../systems/devLog";

/**
 * Fases explícitas da partida (item 8). O ciclo do Phaser (`init/preload/create/update/SHUTDOWN`) já
 * existe, mas não diz nada sobre o estado da PARTIDA — e era justamente aí que o jogo travava sem
 * deixar rastro. Esta máquina não move regra nenhuma: ela nomeia as fases, recusa transição
 * impossível e registra tudo para o despejo de diagnóstico.
 */
export type MatchPhase = "created" | "initializing" | "ready" | "running" | "paused" | "finished" | "destroying" | "destroyed";

const LEGAL: Record<MatchPhase, readonly MatchPhase[]> = {
  created: ["initializing", "destroying"],
  initializing: ["ready", "destroying"],
  ready: ["running", "destroying"],
  running: ["paused", "finished", "destroying"],
  paused: ["running", "finished", "destroying"],
  finished: ["running", "destroying"],
  destroying: ["destroyed"],
  destroyed: [],
};

export class MatchLifecycle {
  private current: MatchPhase = "created";

  get phase(): MatchPhase {
    return this.current;
  }

  /** A partida existe e ainda não foi desmontada. */
  get isLive(): boolean {
    return this.current !== "destroying" && this.current !== "destroyed";
  }

  /** O motor pode avançar (o `paused` continua desenhando, mas não avança o relógio). */
  get canTick(): boolean {
    return this.current === "running";
  }

  /**
   * Devolve `true` quando a transição aconteceu. Transição ilegal é registrada e ignorada — nunca
   * lança, porque isto roda dentro do `update()` e uma exceção lá mata o loop do Phaser.
   */
  transition(next: MatchPhase): boolean {
    if (next === this.current) return false;
    if (!LEGAL[this.current].includes(next)) {
      devAssert(false, `transição de ciclo de vida ilegal: ${this.current} → ${next}`);
      return false;
    }
    const from = this.current;
    this.current = next;
    lifecycleLog("match", next, { from });
    return true;
  }
}
