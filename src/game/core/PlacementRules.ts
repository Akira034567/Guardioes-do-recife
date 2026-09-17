import { GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { PLACEMENT } from "../data/balance";
import type { GuardianDefinition, PlacementMode, Vec2 } from "../types";
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

/** Todos os modos que um Guardião aceita, o principal primeiro. */
export function placementModesOf(definition: Pick<GuardianDefinition, "placementMode" | "altPlacementModes">): readonly PlacementMode[] {
  return definition.altPlacementModes?.length ? [definition.placementMode, ...definition.altPlacementModes] : [definition.placementMode];
}

/** Os modos de toque livre que este Guardião aceita (plataforma tem alvo de clique próprio). */
export function freeModesOf(definition: Pick<GuardianDefinition, "placementMode" | "altPlacementModes">): Array<Exclude<PlacementMode, "platform">> {
  return placementModesOf(definition).filter((mode): mode is Exclude<PlacementMode, "platform"> => mode !== "platform");
}

export interface ModeValidation extends PlacementValidation {
  mode: Exclude<PlacementMode, "platform">;
}

/**
 * Tenta cada modo aceito e devolve o PRIMEIRO válido. Não havendo nenhum, devolve a recusa do modo
 * principal — que é a que o jogador precisa ler: "este aqui é de água" vale mais que "não é margem".
 */
export function validateAnyPlacement(
  modes: ReadonlyArray<Exclude<PlacementMode, "platform">>,
  context: PlacementContext,
  point: Vec2,
): ModeValidation {
  let first: ModeValidation | null = null;
  for (const mode of modes) {
    const result = { ...validatePlacement(mode, context, point), mode };
    if (result.valid) return result;
    first ??= result;
  }
  return first ?? { ...validateWaterPlacement(context, point), mode: "water" };
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
