import type { CurrentZoneDefinition, Vec2 } from "../types";
import { MIN_FLOW_MULTIPLIER, type FlowField } from "./FlowField";
import { normalize, shapeContainsPoint, type Shape2D } from "./Geometry";

export type CurrentOrigin = "map" | "guardian" | "ability" | "interactable";

/** Fatores de amplificação aplicados às correntes naturais do mapa (1 = sem amplificação). */
export interface CurrentAmplification {
  /** Multiplica `strength` da zona direcional. */
  strength: number;
  /** Multiplica a deriva dos projéteis. */
  drift: number;
}

/**
 * Teto de `strength` depois da amplificação. Acima de 1 a componente contrária (`1 - strength`) ficaria
 * negativa e os inimigos andariam de ré — que é justamente o efeito que saiu de cena.
 */
export const MAX_DIRECTIONAL_STRENGTH = 0.9;
export type CurrentAffects = "enemy" | "projectile" | "guardian";

/**
 * Uma corrente marinha (item 16). Direcional (vetor + `strength` = ±fração de velocidade, deriva de
 * projéteis) ou isotrópica (`direction: null`, `strength` = multiplicador de velocidade; a turbulência da
 * Tartaruga). Pode ser natural do mapa, presa a um Guardião, temporária (habilidade) ou de um elemento
 * interativo.
 */
export interface CurrentZone {
  id: string;
  ownerId: string | null;
  origin: CurrentOrigin;
  shape: Shape2D;
  direction: Vec2 | null;
  strength: number;
  projectileDrift: number;
  affects: ReadonlyArray<CurrentAffects>;
  /**
   * Pode ser AMPLIFICADA por um chefe ou evento. Só as correntes naturais do mapa: uma zona criada
   * por Guardião (a Tartaruga) nunca é amplificável, senão a Baleia acabaria reforçando o controle
   * do próprio jogador. É esta flag — e não o `origin` — que o cálculo consulta, para que uma zona
   * de evento futura possa optar por entrar ou não.
   */
  amplifiable: boolean;
  /** Corrente temporária: some quando o tempo passa. */
  expiresAt: number | null;
  /** Zonas contrárias respeitam a resistência a lentidão do inimigo (FlowField); as de mapa não. */
  respectsSlowResistance: boolean;
  visual?: { kind: "motes" | "ring" | "none"; color?: number };
}

export function zoneFromLevel(definition: CurrentZoneDefinition): CurrentZone {
  return {
    id: definition.id,
    ownerId: null,
    origin: "map",
    shape: { kind: "rect", x: definition.x, y: definition.y, width: definition.width, height: definition.height },
    direction: { x: definition.direction.x, y: definition.direction.y },
    strength: definition.speedModifier,
    projectileDrift: definition.projectileDrift,
    affects: ["enemy", "projectile"],
    amplifiable: true,
    expiresAt: null,
    respectsSlowResistance: false,
    visual: { kind: "motes" },
  };
}

export function zoneFromFlowField(field: FlowField): CurrentZone {
  return {
    id: `${field.ownerId}:flow`,
    ownerId: field.ownerId,
    origin: "guardian",
    shape: { kind: "circle", x: field.x, y: field.y, radius: field.radius },
    direction: null,
    strength: field.speedFactor,
    projectileDrift: 0,
    affects: ["enemy"],
    amplifiable: false,
    expiresAt: null,
    respectsSlowResistance: field.mode !== "boost",
    visual: { kind: "ring" },
  };
}

/** Visão de uma zona isotrópica como `FlowField` (overlay de debug e partículas da Tartaruga). */
export function flowFieldFromZone(zone: CurrentZone): FlowField | null {
  if (zone.direction !== null || zone.shape.kind !== "circle") return null;
  return {
    ownerId: zone.ownerId ?? zone.id,
    x: zone.shape.x,
    y: zone.shape.y,
    radius: zone.shape.radius,
    speedFactor: zone.strength,
    mode: zone.strength > 1 ? "boost" : "counter",
  };
}

/**
 * Todas as correntes de uma partida. A velocidade de um inimigo num ponto é
 * `(primeira zona direcional que o contém) × (zona isotrópica mais forte que o contém)`, exatamente como
 * `CurrentField` + `FlowField` calculavam antes.
 */
export class CurrentSystem {
  private readonly mapZones: CurrentZone[] = [];
  private readonly ownerZones = new Map<string, CurrentZone[]>();
  private readonly temporary: CurrentZone[] = [];
  private readonly amplifiers = new Map<string, CurrentAmplification>();

  static fromLevel(currents: readonly CurrentZoneDefinition[]): CurrentSystem {
    const system = new CurrentSystem();
    currents.forEach((definition) => system.mapZones.push(zoneFromLevel(definition)));
    return system;
  }

  get amplified(): boolean {
    return this.amplifiers.size > 0;
  }

  /**
   * Amplificação em vigor: com várias fontes vale a MAIOR de cada fator, nunca o produto — duas
   * Baleias vivas engrossam a maré uma vez só.
   */
  get amplification(): CurrentAmplification {
    let strength = 1;
    let drift = 1;
    for (const value of this.amplifiers.values()) {
      strength = Math.max(strength, value.strength);
      drift = Math.max(drift, value.drift);
    }
    return { strength, drift };
  }

  /** Liga/desliga a amplificação de uma fonte (`null` = desliga). Só afeta zonas `amplifiable`. */
  setAmplified(sourceId: string, amplification: CurrentAmplification | null): void {
    if (!amplification || (amplification.strength <= 1 && amplification.drift <= 1)) this.amplifiers.delete(sourceId);
    else this.amplifiers.set(sourceId, amplification);
  }

  /** Substitui as zonas de um dono (Tartaruga a cada frame; venda → lista vazia). */
  setOwnerZones(ownerId: string, zones: readonly CurrentZone[]): void {
    if (zones.length === 0) this.ownerZones.delete(ownerId);
    else this.ownerZones.set(ownerId, [...zones]);
  }

  addTemporary(zone: CurrentZone): void {
    this.temporary.push(zone);
  }

  update(now: number): void {
    for (let index = this.temporary.length - 1; index >= 0; index -= 1) {
      const zone = this.temporary[index];
      if (zone.expiresAt !== null && now >= zone.expiresAt) this.temporary.splice(index, 1);
    }
  }

  zones(filter?: (zone: CurrentZone) => boolean): CurrentZone[] {
    const all = [...this.mapZones, ...this.temporary, ...[...this.ownerZones.values()].flat()];
    return filter ? all.filter(filter) : all;
  }

  /** Zonas isotrópicas presas a Guardiões, na forma antiga (`FlowField`). */
  get flowFields(): FlowField[] {
    const fields: FlowField[] = [];
    for (const zones of this.ownerZones.values()) {
      for (const zone of zones) {
        const field = flowFieldFromZone(zone);
        if (field) fields.push(field);
      }
    }
    return fields;
  }

  /** Multiplicador de velocidade de um inimigo em `point` movendo-se na direção `tangent`. */
  enemySpeedMultiplier(point: Vec2, tangent: Vec2, slowResistance = 0): number {
    let directional = 1;
    const zone = this.directionalZones().find((candidate) => candidate.affects.includes("enemy") && shapeContainsPoint(candidate.shape, point));
    if (zone && zone.direction) {
      const current = normalize(zone.direction);
      const movement = normalize(tangent);
      const dot = current.x * movement.x + current.y * movement.y;
      // A Baleia engrossa a corrente natural: a favor empurra mais, contra segura mais. O teto existe
      // para `1 - strength` nunca chegar a zero, o que pararia (ou faria andar de ré) quem nada contra.
      const strength = Math.min(MAX_DIRECTIONAL_STRENGTH, zone.strength * (zone.amplifiable ? this.amplification.strength : 1));
      directional = dot >= 0 ? 1 + strength : 1 - strength;
    }
    let slowest = 1;
    let fastest = 1;
    for (const iso of this.isotropicZones()) {
      if (!iso.affects.includes("enemy") || !shapeContainsPoint(iso.shape, point)) continue;
      if (iso.strength > 1) {
        fastest = Math.max(fastest, iso.strength);
      } else {
        const resisted = iso.respectsSlowResistance ? 1 - (1 - iso.strength) * (1 - Math.max(0, Math.min(1, slowResistance))) : iso.strength;
        slowest = Math.min(slowest, resisted);
      }
    }
    return directional * Math.max(MIN_FLOW_MULTIPLIER, slowest * fastest);
  }

  /** Deslocamento de um projétil em `point` durante `deltaSeconds`. */
  projectileDrift(point: Vec2, deltaSeconds: number): Vec2 {
    const zone = this.directionalZones().find((candidate) => candidate.affects.includes("projectile") && shapeContainsPoint(candidate.shape, point));
    if (!zone || !zone.direction || zone.projectileDrift === 0) return { x: 0, y: 0 };
    const current = normalize(zone.direction);
    const drift = zone.projectileDrift * (zone.amplifiable ? this.amplification.drift : 1);
    return { x: current.x * drift * deltaSeconds, y: current.y * drift * deltaSeconds };
  }

  private directionalZones(): CurrentZone[] {
    return [...this.mapZones, ...this.temporary, ...[...this.ownerZones.values()].flat()].filter((zone) => zone.direction !== null);
  }

  private isotropicZones(): CurrentZone[] {
    return [...this.temporary, ...[...this.ownerZones.values()].flat()].filter((zone) => zone.direction === null);
  }
}
