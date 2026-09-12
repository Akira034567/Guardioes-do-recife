import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { PLACEMENT } from "../data/balance";
import type { PlacementMode, Vec2 } from "../types";
import type { RoutePath } from "./RoutePath";

/** Área jogável para unidades de água e margem. */
export const PLAYFIELD_BOUNDS = {
  minX: 44,
  maxX: GAME_WIDTH - 44,
  minY: HUD_TOP + 38,
  maxY: GAME_HEIGHT - HUD_BOTTOM - 38,
} as const;

export interface PlacementContext {
  route: RoutePath;
  /** Plataformas de pedra da fase. */
  platforms: readonly Vec2[];
  /** Todos os Guardiões já posicionados. */
  guardians: readonly Vec2[];
  /** Guardiões em cima da rota (bloqueadores, armadilhas, corpo a corpo). */
  routeUnits: readonly Vec2[];
}

export interface PlacementValidation {
  valid: boolean;
  reason: string;
  /** Posição final (a rota "snapa" para a linha central). */
  x: number;
  y: number;
  /** Distância ao longo da rota, quando a unidade fica em cima dela. */
  routeDistance: number | null;
  progress: number;
}

export const PLACEMENT_HINTS: Record<PlacementMode, string> = {
  platform: "uma plataforma de pedra",
  water: "uma área livre da água",
  route: "qualquer ponto da correnteza",
  margin: "a beira da correnteza",
};

function insidePlayfield(point: Vec2): boolean {
  return point.x >= PLAYFIELD_BOUNDS.minX && point.x <= PLAYFIELD_BOUNDS.maxX && point.y >= PLAYFIELD_BOUNDS.minY && point.y <= PLAYFIELD_BOUNDS.maxY;
}

function near(point: Vec2, others: readonly Vec2[], distance: number): boolean {
  return others.some((other) => Math.hypot(point.x - other.x, point.y - other.y) < distance);
}

export function validateWaterPlacement(context: PlacementContext, point: Vec2): PlacementValidation {
  const result: PlacementValidation = { valid: true, reason: "Posição válida", x: point.x, y: point.y, routeDistance: null, progress: 0 };
  if (!insidePlayfield(point)) return { ...result, valid: false, reason: "Fora da área jogável" };
  const closest = context.route.getClosestPoint(point);
  result.progress = closest.progress;
  if (closest.distance < PLACEMENT.waterRouteClearance) return { ...result, valid: false, reason: "Muito perto da rota" };
  if (near(point, context.platforms, PLACEMENT.separation)) return { ...result, valid: false, reason: "Plataforma ocupa este espaço" };
  if (near(point, context.guardians, PLACEMENT.separation)) return { ...result, valid: false, reason: "Muito perto de outro Guardião" };
  return result;
}

export function validateRoutePlacement(context: PlacementContext, point: Vec2): PlacementValidation {
  const closest = context.route.getClosestPoint(point);
  const result: PlacementValidation = {
    valid: true,
    reason: "Posição válida",
    x: closest.point.x,
    y: closest.point.y,
    routeDistance: closest.routeDistance,
    progress: closest.progress,
  };
  if (closest.distance > PLACEMENT.routeClearance) return { ...result, valid: false, reason: "Toque dentro da correnteza" };
  if (closest.routeDistance < PLACEMENT.routeEndClearance || closest.routeDistance > context.route.totalLength - PLACEMENT.routeEndClearance) {
    return { ...result, valid: false, reason: "Muito perto da entrada ou do Recife" };
  }
  if (near(closest.point, context.routeUnits, PLACEMENT.routeSeparation)) {
    return { ...result, valid: false, reason: "Muito perto de outro Guardião da correnteza" };
  }
  return result;
}

/** Margem: água colada à rota, entre `marginMin` e `marginMax` da linha central. */
export function validateMarginPlacement(context: PlacementContext, point: Vec2): PlacementValidation {
  const result: PlacementValidation = { valid: true, reason: "Posição válida", x: point.x, y: point.y, routeDistance: null, progress: 0 };
  if (!insidePlayfield(point)) return { ...result, valid: false, reason: "Fora da área jogável" };
  const closest = context.route.getClosestPoint(point);
  result.progress = closest.progress;
  if (closest.distance < PLACEMENT.marginMin) return { ...result, valid: false, reason: "Em cima da correnteza: fique na beira" };
  if (closest.distance > PLACEMENT.marginMax) return { ...result, valid: false, reason: "Longe demais da correnteza" };
  if (near(point, context.platforms, PLACEMENT.separation)) return { ...result, valid: false, reason: "Plataforma ocupa este espaço" };
  if (near(point, context.guardians, PLACEMENT.separation)) return { ...result, valid: false, reason: "Muito perto de outro Guardião" };
  return result;
}

/** Validação para os modos de toque livre (plataformas são tratadas pelos seus próprios alvos de clique). */
export function validatePlacement(mode: Exclude<PlacementMode, "platform">, context: PlacementContext, point: Vec2): PlacementValidation {
  switch (mode) {
    case "water":
      return validateWaterPlacement(context, point);
    case "route":
      return validateRoutePlacement(context, point);
    case "margin":
      return validateMarginPlacement(context, point);
  }
}
