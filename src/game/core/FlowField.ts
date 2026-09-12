import type { FlowFieldEffect, Vec2 } from "../types";

/**
 * Zona ambiental circular presa a um Guardião que altera a velocidade da água (Tartaruga).
 * Diferente de um debuff, o efeito existe enquanto o inimigo estiver dentro da zona.
 * `mode` prepara extensões: `counter` reduz a velocidade, `boost` aumenta, `reverse` fica reservado
 * para interagir com correntes naturais do mapa.
 */
export interface FlowField extends Vec2 {
  ownerId: string;
  radius: number;
  /** Multiplicador de velocidade dentro da zona (0.75 = -25%). */
  speedFactor: number;
  mode: "counter" | "boost" | "reverse";
}

export const MIN_FLOW_MULTIPLIER = 0.3;

export function containsFlowPoint(field: FlowField, point: Vec2): boolean {
  return Math.hypot(point.x - field.x, point.y - field.y) <= field.radius;
}

/**
 * Multiplicador de velocidade em um ponto: vale a zona mais forte (não acumula). Zonas contrárias
 * respeitam a resistência a lentidão do inimigo; zonas de impulso não.
 */
export function flowSpeedMultiplier(fields: readonly FlowField[], point: Vec2, slowResistance = 0): number {
  let slowest = 1;
  let fastest = 1;
  for (const field of fields) {
    if (!containsFlowPoint(field, point)) continue;
    if (field.mode === "boost") {
      fastest = Math.max(fastest, field.speedFactor);
    } else {
      const resisted = 1 - (1 - field.speedFactor) * (1 - Math.max(0, Math.min(1, slowResistance)));
      slowest = Math.min(slowest, resisted);
    }
  }
  return Math.max(MIN_FLOW_MULTIPLIER, slowest * fastest);
}

export function flowFieldFor(owner: Vec2 & { id: string }, effect: FlowFieldEffect, range: number): FlowField {
  return {
    ownerId: owner.id,
    x: owner.x,
    y: owner.y,
    radius: range * effect.radiusMultiplier,
    speedFactor: effect.speedFactor,
    mode: effect.speedFactor > 1 ? "boost" : "counter",
  };
}
