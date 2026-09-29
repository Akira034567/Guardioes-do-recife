import type { GateDefinition, WhirlpoolDefinition } from "../types";

/**
 * APARELHOS DO MAPA dos Canais Profundos: comportas e redemoinhos. Regras puras, sem Phaser — a
 * partida (`Match`) avança o relógio e aplica os efeitos; a cena só desenha o que o snapshot mostra.
 *
 * Os dois respondem ao mesmo comando do jogador (`useMapDevice`), porque para quem joga os dois são
 * a mesma coisa: "algo no mapa que eu toco para mudar a água".
 */

/** Prefixo de `group.pathId` que entrega a escolha do canal para uma comporta. */
export const GATE_PATH_PREFIX = "gate:";

export interface GateRuntime {
  definition: GateDefinition;
  /** Índice em `definition.routes` do canal aberto agora. */
  open: 0 | 1;
  /** Antes disto a alavanca não mexe (recém-virada). */
  readyAt: number;
}

export interface WhirlpoolRuntime {
  definition: WhirlpoolDefinition;
  /** Próximo puxão. */
  nextPullAt: number;
  /** Dormente: gira até aqui depois de acordado. Sempre ativo: `Infinity`. */
  activeUntil: number;
  /** Dormente: pode ser acordado de novo a partir daqui. */
  readyAt: number;
  /** Quem este redemoinho já arrastou, e quando: ver `PULL_IMMUNITY_MS`. */
  pulledAt: Map<string, number>;
}

/**
 * Um mesmo inimigo só é arrastado pelo MESMO redemoinho uma vez a cada tanto. Sem isto, um bicho
 * lento e com lentidão (Tartaruga Corrompida sob a Água-viva) nunca andaria o bastante entre dois
 * puxões para sair da zona — ficaria preso para sempre, e a onda nunca acabaria.
 */
export const PULL_IMMUNITY_MS = 9000;

export type DeviceUseResult =
  | { ok: true; kind: "gate"; routeId: string }
  | { ok: true; kind: "whirlpool"; activeUntil: number }
  | { ok: false; reason: "notFound" | "cooldown" | "alwaysOn"; readyInMs?: number };

/** O que um puxão precisa saber de um inimigo (`MatchEnemy` satisfaz). */
export interface PullableEnemy {
  id: string;
  x: number;
  y: number;
  pathDistance: number;
  dead: boolean;
  reachedGoal: boolean;
  blockedById: string | null;
  definition: { isBoss?: boolean; role: string };
  setPathDistance(distance: number): void;
}

export class MapDevices {
  private readonly gates = new Map<string, GateRuntime>();
  private readonly whirlpools = new Map<string, WhirlpoolRuntime>();

  constructor(gates: readonly GateDefinition[] = [], whirlpools: readonly WhirlpoolDefinition[] = []) {
    for (const definition of gates) this.gates.set(definition.id, { definition, open: definition.initial ?? 0, readyAt: 0 });
    for (const definition of whirlpools) {
      this.whirlpools.set(definition.id, {
        definition,
        nextPullAt: definition.intervalMs,
        activeUntil: definition.dormant ? 0 : Number.POSITIVE_INFINITY,
        readyAt: 0,
        pulledAt: new Map(),
      });
    }
  }

  get isEmpty(): boolean {
    return this.gates.size === 0 && this.whirlpools.size === 0;
  }

  gateStates(): readonly GateRuntime[] {
    return [...this.gates.values()];
  }

  whirlpoolStates(): readonly WhirlpoolRuntime[] {
    return [...this.whirlpools.values()];
  }

  /**
   * Rota de um grupo. `gate:<id>` vira o canal aberto daquela comporta NA HORA DO NASCIMENTO: quem
   * já está nadando não muda de canal quando a alavanca vira — só os próximos.
   */
  resolvePath(pathId: string): string {
    if (!pathId.startsWith(GATE_PATH_PREFIX)) return pathId;
    const gate = this.gates.get(pathId.slice(GATE_PATH_PREFIX.length));
    return gate ? gate.definition.routes[gate.open] : pathId;
  }

  /** O jogador tocou num aparelho. */
  use(deviceId: string, now: number): DeviceUseResult {
    const gate = this.gates.get(deviceId);
    if (gate) {
      if (now < gate.readyAt) return { ok: false, reason: "cooldown", readyInMs: gate.readyAt - now };
      gate.open = gate.open === 0 ? 1 : 0;
      gate.readyAt = now + gate.definition.cooldownMs;
      return { ok: true, kind: "gate", routeId: gate.definition.routes[gate.open] };
    }
    const whirlpool = this.whirlpools.get(deviceId);
    if (!whirlpool) return { ok: false, reason: "notFound" };
    const dormant = whirlpool.definition.dormant;
    if (!dormant) return { ok: false, reason: "alwaysOn" };
    if (now < whirlpool.readyAt) return { ok: false, reason: "cooldown", readyInMs: whirlpool.readyAt - now };
    whirlpool.activeUntil = now + dormant.activeMs;
    whirlpool.readyAt = whirlpool.activeUntil + dormant.cooldownMs;
    // Acordou: o primeiro puxão sai logo, senão o toque parece não ter feito nada.
    whirlpool.nextPullAt = now + Math.min(600, whirlpool.definition.intervalMs);
    return { ok: true, kind: "whirlpool", activeUntil: whirlpool.activeUntil };
  }

  /**
   * Avança os redemoinhos. Devolve, por redemoinho que puxou neste tique, quem foi arrastado.
   * Chefes nunca são arrastados; elites vão pela metade; quem está preso num bloqueio fica.
   */
  tickWhirlpools<E extends PullableEnemy>(now: number, enemies: readonly E[]): Array<{ runtime: WhirlpoolRuntime; pulled: E[] }> {
    const pulses: Array<{ runtime: WhirlpoolRuntime; pulled: E[] }> = [];
    for (const runtime of this.whirlpools.values()) {
      if (now > runtime.activeUntil || now < runtime.nextPullAt) continue;
      runtime.nextPullAt = now + runtime.definition.intervalMs;
      const { x, y, radius, pullBack } = runtime.definition;
      const pulled: E[] = [];
      for (const enemy of enemies) {
        if (enemy.dead || enemy.reachedGoal || enemy.blockedById || enemy.definition.isBoss) continue;
        if (Math.hypot(enemy.x - x, enemy.y - y) > radius) continue;
        const last = runtime.pulledAt.get(enemy.id);
        if (last !== undefined && now - last < PULL_IMMUNITY_MS) continue;
        runtime.pulledAt.set(enemy.id, now);
        const distance = enemy.definition.role === "elite" ? pullBack / 2 : pullBack;
        enemy.setPathDistance(Math.max(0, enemy.pathDistance - distance));
        pulled.push(enemy);
      }
      pulses.push({ runtime, pulled });
    }
    return pulses;
  }
}
