import type { CurrentZoneDefinition, Vec2 } from "../types";

export function containsPoint(zone: CurrentZoneDefinition, point: Vec2): boolean {
  return (
    point.x >= zone.x &&
    point.x <= zone.x + zone.width &&
    point.y >= zone.y &&
    point.y <= zone.y + zone.height
  );
}

export function normalizedDirection(zone: CurrentZoneDefinition, reversed = false): Vec2 {
  const length = Math.hypot(zone.direction.x, zone.direction.y) || 1;
  const sign = reversed ? -1 : 1;
  const x = (zone.direction.x / length) * sign;
  const y = (zone.direction.y / length) * sign;
  return {
    x: Object.is(x, -0) ? 0 : x,
    y: Object.is(y, -0) ? 0 : y,
  };
}

export function enemySpeedMultiplier(
  zone: CurrentZoneDefinition,
  movementDirection: Vec2,
  reversed = false,
): number {
  const current = normalizedDirection(zone, reversed);
  const movementLength = Math.hypot(movementDirection.x, movementDirection.y) || 1;
  const dot = current.x * (movementDirection.x / movementLength) + current.y * (movementDirection.y / movementLength);
  return dot >= 0 ? 1 + zone.speedModifier : 1 - zone.speedModifier;
}

export function projectileDrift(
  zone: CurrentZoneDefinition,
  deltaSeconds: number,
  reversed = false,
): Vec2 {
  const direction = normalizedDirection(zone, reversed);
  return {
    x: direction.x * zone.projectileDrift * deltaSeconds,
    y: direction.y * zone.projectileDrift * deltaSeconds,
  };
}
