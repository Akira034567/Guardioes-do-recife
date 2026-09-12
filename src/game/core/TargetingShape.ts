import type { Vec2 } from "../types";
import { isInRange } from "./Combat";

/**
 * Forma do alcance de um Guardião (item 18). Radial é o padrão de todos hoje; as outras existem para
 * unidades futuras e para desenhar o alcance certo no preview e no overlay de debug.
 */
export type TargetingShape =
  | { kind: "radial" }
  /** Setor à frente da unidade; `facing` decide para onde o cone aponta. */
  | { kind: "cone"; angleDeg: number; facing: "nearestRoute" | "fixed"; facingDeg?: number }
  /** Faixa reta de largura `width` no comprimento do alcance. */
  | { kind: "line"; width: number; facing: "nearestRoute" | "fixed"; facingDeg?: number }
  /** Círculo como o radial, mas com a semântica "atinge todos" (pulso, giro). */
  | { kind: "area"; radiusMultiplier?: number }
  /** Janela medida em distância de rota (bloqueadores, armadilhas). */
  | { kind: "route"; behind: number; ahead: number }
  | { kind: "global" };

/** Origem de um alcance: posição e, quando útil, a posição na rota e a direção. */
export interface TargetOrigin extends Vec2 {
  routeDistance?: number | null;
  facingRad?: number;
  pathId?: string;
}

/** Ponto testado contra uma forma; `pathDistance`/`pathId` só importam para a forma `route`. */
export interface ShapePoint extends Vec2 {
  pathDistance?: number;
  pathId?: string;
}

export const RADIAL: TargetingShape = { kind: "radial" };

export type ShapeOutline =
  | { kind: "circle"; x: number; y: number; radius: number }
  | { kind: "polygon"; points: Vec2[] }
  | { kind: "none" };

const facingOf = (shape: { facing: "nearestRoute" | "fixed"; facingDeg?: number }, origin: TargetOrigin): number =>
  shape.facing === "fixed" ? ((shape.facingDeg ?? 0) * Math.PI) / 180 : (origin.facingRad ?? 0);

export function shapeContains(shape: TargetingShape, origin: TargetOrigin, range: number, point: ShapePoint): boolean {
  switch (shape.kind) {
    case "radial":
      return isInRange(origin, point, range);
    case "area":
      return isInRange(origin, point, range * (shape.radiusMultiplier ?? 1));
    case "global":
      return true;
    case "cone": {
      if (!isInRange(origin, point, range)) return false;
      const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
      const delta = Math.abs(Math.atan2(Math.sin(angle - facingOf(shape, origin)), Math.cos(angle - facingOf(shape, origin))));
      return delta <= ((shape.angleDeg / 2) * Math.PI) / 180;
    }
    case "line": {
      const facing = facingOf(shape, origin);
      const dx = point.x - origin.x;
      const dy = point.y - origin.y;
      const along = dx * Math.cos(facing) + dy * Math.sin(facing);
      if (along < 0 || along > range) return false;
      const across = Math.abs(-dx * Math.sin(facing) + dy * Math.cos(facing));
      return across <= shape.width / 2;
    }
    case "route": {
      if (origin.routeDistance === null || origin.routeDistance === undefined) return false;
      if (point.pathDistance === undefined) return false;
      if (origin.pathId !== undefined && point.pathId !== undefined && origin.pathId !== point.pathId) return false;
      const delta = point.pathDistance - origin.routeDistance;
      return delta >= -shape.behind && delta <= shape.ahead;
    }
  }
}

/** Contorno para desenhar o alcance (preview de posicionamento, anel de seleção, debug). */
export function shapeOutline(shape: TargetingShape, origin: TargetOrigin, range: number): ShapeOutline {
  switch (shape.kind) {
    case "radial":
      return { kind: "circle", x: origin.x, y: origin.y, radius: range };
    case "area":
      return { kind: "circle", x: origin.x, y: origin.y, radius: range * (shape.radiusMultiplier ?? 1) };
    case "cone": {
      const facing = facingOf(shape, origin);
      const half = ((shape.angleDeg / 2) * Math.PI) / 180;
      const points: Vec2[] = [{ x: origin.x, y: origin.y }];
      const steps = 12;
      for (let index = 0; index <= steps; index += 1) {
        const angle = facing - half + (2 * half * index) / steps;
        points.push({ x: origin.x + Math.cos(angle) * range, y: origin.y + Math.sin(angle) * range });
      }
      return { kind: "polygon", points };
    }
    case "line": {
      const facing = facingOf(shape, origin);
      const half = shape.width / 2;
      const ax = Math.cos(facing);
      const ay = Math.sin(facing);
      const nx = -ay * half;
      const ny = ax * half;
      return {
        kind: "polygon",
        points: [
          { x: origin.x + nx, y: origin.y + ny },
          { x: origin.x + ax * range + nx, y: origin.y + ay * range + ny },
          { x: origin.x + ax * range - nx, y: origin.y + ay * range - ny },
          { x: origin.x - nx, y: origin.y - ny },
        ],
      };
    }
    case "route":
    case "global":
      return { kind: "none" };
  }
}
