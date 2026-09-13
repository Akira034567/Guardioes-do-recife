import { spriteTilt } from "./SpriteOrientation";
import type { ResolvedEnemyDefinition, Vec2 } from "../types";

/**
 * Pontos fracos de chefe (item 11). Genérico de propósito: nada aqui sabe de baleia nem de coral.
 * Um chefe declara um `WeakPointPlan` e ganha filhos alvejáveis presos ao corpo; quebrar um deles
 * rasga o chefe por dentro.
 */

export interface WeakPointAnchor {
  /** Deslocamento em MÚLTIPLOS do `hitRadius` do pai, no espaço local dele (nariz em +x). */
  dx: number;
  dy: number;
}

export interface WeakPointPlan {
  id: string;
  name: string;
  count: number;
  /** Vida de cada ponto, como fração da vida máxima do pai. 🔶 placeholder. */
  hpFraction: number;
  /** Dano no pai ao romper um ponto, como fração da vida máxima dele. 🔶 placeholder. */
  damageOnBreakFraction: number;
  hitRadius: number;
  anchors: WeakPointAnchor[];
  color: number;
  accent: number;
  /** Arte opcional; sem ela a apresentação desenha a forma vetorial. */
  art?: { folder: string; file: string; scale?: number };
}

/**
 * Onde o ponto fraco está no mundo. Usa EXATAMENTE a mesma transformação que a view aplica ao
 * sprite do pai (`SpriteOrientation`) — se as duas divergissem em um grau, os pontos descolariam
 * do corpo do chefe conforme ele faz as curvas da rota.
 */
export function weakPointWorldPosition(
  parent: { x: number; y: number; heading: number },
  anchor: WeakPointAnchor,
  parentHitRadius: number,
): Vec2 {
  const mirrored = Math.cos(parent.heading) < 0;
  const tilt = mirrored ? -spriteTilt(parent.heading) : spriteTilt(parent.heading);
  const localX = (mirrored ? -anchor.dx : anchor.dx) * parentHitRadius;
  const localY = anchor.dy * parentHitRadius;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  return {
    x: parent.x + localX * cos - localY * sin,
    y: parent.y + localX * sin + localY * cos,
  };
}

/**
 * Definição do ponto fraco, derivada do pai em tempo de execução.
 *
 * Os zeros são o contrato: sem recompensa, sem dano ao Recife, sem velocidade. Ele não é um
 * inimigo da onda — não conta para a vitória, não paga pérola de abate e não entra no bestiário.
 */
export function weakPointDefinition(plan: WeakPointPlan, parent: ResolvedEnemyDefinition): ResolvedEnemyDefinition {
  return {
    ...parent,
    name: plan.name,
    role: "common",
    isBoss: false,
    unblockable: true,
    maxHealth: Math.max(1, Math.round(parent.maxHealth * plan.hpFraction)),
    speed: 0,
    reward: 0,
    reefDamage: 0,
    hitRadius: plan.hitRadius,
    armor: 0,
    color: plan.color,
    accent: plan.accent,
    tags: ["WEAK_POINT"],
    abilities: [],
    boss: undefined,
    resistances: {},
    immunities: [],
    threatLevel: 2,
  };
}

/** Quanto o chefe perde quando um ponto se rompe. */
export function weakPointBurstDamage(plan: WeakPointPlan, parent: ResolvedEnemyDefinition): number {
  return Math.max(1, Math.round(parent.maxHealth * plan.damageOnBreakFraction));
}
