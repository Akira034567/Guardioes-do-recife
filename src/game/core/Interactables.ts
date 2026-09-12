import type { EnemyId, InteractableDefinition, Vec2 } from "../types";

/**
 * Interagíveis do mapa (item 28): a rede que prende a Tartaruga, a gruta do Tubarão, a pedra que
 * pisca. Regra pura — recebe o estado da partida, devolve progresso e conclusão. Quem desenha e quem
 * paga a recompensa (aliado, corrente, segredo) é o motor.
 */
export type InteractableState = "locked" | "available" | "working" | "done";

export interface InteractableRuntime {
  readonly definition: InteractableDefinition;
  state: InteractableState;
  /** 0..1 para a argola de progresso. */
  progress: number;
  /** Instante em que um novo toque volta a valer (`taps`). */
  readyAt: number;
  /** Tempo acumulado com Guardião por perto (`guardNearby`). */
  nearbyMs: number;
  /** Inimigos guardiões já derrotados (`enemyDefeated`). */
  defeated: number;
}

export interface InteractableContext {
  /** Onda em curso, 1-based. */
  wave: number;
  guardians: readonly Vec2[];
  /** Milissegundos desde o tick anterior. */
  deltaMs: number;
}

export type InteractResult =
  | { ok: true; completed: boolean; progress: number }
  | { ok: false; reason: "notFound" | "locked" | "cooldown" | "done" | "notTappable" };

const DEFAULT_RADIUS = 34;

export class InteractableSystem {
  private readonly runtimes: InteractableRuntime[];

  constructor(definitions: readonly InteractableDefinition[] = []) {
    this.runtimes = definitions.map((definition) => ({
      definition,
      state: (definition.availableFromWave ?? 1) > 1 ? "locked" : "available",
      progress: 0,
      readyAt: 0,
      nearbyMs: 0,
      defeated: 0,
    }));
  }

  get isEmpty(): boolean {
    return this.runtimes.length === 0;
  }

  states(): readonly InteractableRuntime[] {
    return this.runtimes;
  }

  get(id: string): InteractableRuntime | undefined {
    return this.runtimes.find((runtime) => runtime.definition.id === id);
  }

  /** Ids concluídos, na ordem em que caíram. */
  completed(): string[] {
    return this.runtimes.filter((runtime) => runtime.state === "done").map((runtime) => runtime.definition.id);
  }

  /**
   * Avança o tempo. Devolve os que concluíram neste tick, para o motor pagar a recompensa uma vez só.
   */
  tick(now: number, context: InteractableContext): InteractableRuntime[] {
    const finished: InteractableRuntime[] = [];
    for (const runtime of this.runtimes) {
      if (runtime.state === "done") continue;
      if (runtime.state === "locked") {
        if (context.wave < (runtime.definition.availableFromWave ?? 1)) continue;
        runtime.state = "available";
      }
      const goal = runtime.definition.goal;
      if (goal.type !== "guardNearby") continue;
      const radius = goal.radius;
      const near = context.guardians.some((guardian) => Math.hypot(guardian.x - runtime.definition.x, guardian.y - runtime.definition.y) <= radius);
      // Sair de perto não zera o progresso: o trabalho feito continua valendo.
      if (near) {
        runtime.nearbyMs = Math.min(goal.durationMs, runtime.nearbyMs + context.deltaMs);
        runtime.state = "working";
      }
      runtime.progress = goal.durationMs > 0 ? runtime.nearbyMs / goal.durationMs : 1;
      if (runtime.nearbyMs >= goal.durationMs) {
        runtime.state = "done";
        runtime.progress = 1;
        finished.push(runtime);
      }
    }
    void now;
    return finished;
  }

  /** Um toque do jogador. */
  interact(id: string, now: number): InteractResult {
    const runtime = this.get(id);
    if (!runtime) return { ok: false, reason: "notFound" };
    if (runtime.state === "done") return { ok: false, reason: "done" };
    if (runtime.state === "locked") return { ok: false, reason: "locked" };
    const goal = runtime.definition.goal;
    if (goal.type === "reveal") {
      runtime.state = "done";
      runtime.progress = 1;
      return { ok: true, completed: true, progress: 1 };
    }
    if (goal.type !== "taps") return { ok: false, reason: "notTappable" };
    if (now < runtime.readyAt) return { ok: false, reason: "cooldown" };
    runtime.state = "working";
    runtime.readyAt = now + goal.cooldownMs;
    runtime.progress = Math.min(1, runtime.progress + 1 / goal.taps);
    const done = runtime.progress >= 1 - 1e-6;
    if (done) {
      runtime.state = "done";
      runtime.progress = 1;
    }
    return { ok: true, completed: done, progress: runtime.progress };
  }

  /** Avisa que um inimigo morreu; devolve os interagíveis que isso concluiu. */
  onEnemyKilled(enemyId: EnemyId): InteractableRuntime[] {
    const finished: InteractableRuntime[] = [];
    for (const runtime of this.runtimes) {
      const goal = runtime.definition.goal;
      if (runtime.state === "done" || runtime.state === "locked" || goal.type !== "enemyDefeated" || goal.enemyId !== enemyId) continue;
      runtime.defeated += 1;
      const target = goal.count ?? 1;
      runtime.progress = Math.min(1, runtime.defeated / target);
      runtime.state = "working";
      if (runtime.defeated >= target) {
        runtime.state = "done";
        runtime.progress = 1;
        finished.push(runtime);
      }
    }
    return finished;
  }

  /** Raio de toque de um interagível. */
  static radiusOf(definition: InteractableDefinition): number {
    return definition.radius ?? DEFAULT_RADIUS;
  }
}
