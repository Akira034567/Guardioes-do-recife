import { hubBehavior, type HubBehaviorProfile } from "../../data/reef/hubBehaviors";
import { REEF_REST_SPOTS, type ReefRestSpot } from "../../data/reef/layout";
import { ReefInhabitant, type InhabitantSnapshot, type ReefWorld } from "./ReefInhabitant";

/**
 * O cardume do Recife: um `tick` só para a cena chamar. Quem entra e quem sai é decidido pelo
 * conjunto de Guardiões desbloqueados, e trocar a lista não recria quem já estava nadando.
 */

export interface ReefLifeOptions {
  guardianIds: readonly string[];
  seed: number | string;
  restSpots?: readonly ReefRestSpot[];
}

export class ReefLife {
  private readonly seed: number | string;
  private readonly restSpots: readonly ReefRestSpot[];
  private readonly inhabitants = new Map<string, ReefInhabitant>();

  constructor(options: ReefLifeOptions) {
    this.seed = options.seed;
    this.restSpots = options.restSpots ?? REEF_REST_SPOTS;
    this.setResidents(options.guardianIds);
  }

  get size(): number {
    return this.inhabitants.size;
  }

  profiles(): readonly HubBehaviorProfile[] {
    return [...this.inhabitants.values()].map((inhabitant) => inhabitant.profile);
  }

  /** Entra e sai morador sem recriar os outros: um Guardião novo não reembaralha o Recife. */
  setResidents(guardianIds: readonly string[]): void {
    const wanted = new Set(guardianIds);
    for (const id of [...this.inhabitants.keys()]) {
      if (!wanted.has(id)) this.inhabitants.delete(id);
    }
    for (const id of guardianIds) {
      if (!this.inhabitants.has(id)) this.inhabitants.set(id, new ReefInhabitant(hubBehavior(id), this.seed));
    }
  }

  /** Avança todo mundo e devolve os retratos, na ordem em que os moradores entraram. */
  tick(dtMs: number, world: Omit<ReefWorld, "restSpots">): readonly InhabitantSnapshot[] {
    const full: ReefWorld = { ...world, restSpots: this.restSpots };
    const snapshots: InhabitantSnapshot[] = [];
    for (const inhabitant of this.inhabitants.values()) {
      inhabitant.tick(dtMs, full);
      snapshots.push(inhabitant.snapshot());
    }
    return snapshots;
  }

  snapshots(): readonly InhabitantSnapshot[] {
    return [...this.inhabitants.values()].map((inhabitant) => inhabitant.snapshot());
  }
}
