import type { Vec2 } from "../types";

export interface TargetCandidate extends Vec2 {
  progress: number;
  dead: boolean;
  reachedGoal: boolean;
}

export function isInRange(origin: Vec2, target: Vec2, range: number): boolean {
  return Math.hypot(target.x - origin.x, target.y - origin.y) <= range;
}

export function selectLeadingTarget<T extends TargetCandidate>(
  candidates: readonly T[],
  origin: Vec2,
  range: number,
): T | undefined {
  return candidates
    .filter((candidate) => !candidate.dead && !candidate.reachedGoal && isInRange(origin, candidate, range))
    .sort((a, b) => b.progress - a.progress)[0];
}

export function mitigatedDamage(rawDamage: number, armor: number): number {
  return Math.max(1, rawDamage - Math.max(0, armor));
}

export function projectileTurnRate(predictiveAim: boolean, priorHitCount: number): number {
  if (predictiveAim) return 12;
  return priorHitCount > 0 ? 1.25 : 7;
}

export function hasReachedBlockerContact(
  enemyRouteDistance: number,
  blockerRouteDistance: number,
  combinedRadius: number,
): boolean {
  const contactDistance = blockerRouteDistance - combinedRadius;
  return enemyRouteDistance >= contactDistance && enemyRouteDistance <= blockerRouteDistance + 12;
}

export interface MovingTarget extends Vec2 {
  velocity: Vec2;
}

export function predictInterceptPoint(origin: Vec2, target: MovingTarget, projectileSpeed: number): Vec2 {
  const relativeX = target.x - origin.x;
  const relativeY = target.y - origin.y;
  const velocity = target.velocity;
  const a = velocity.x * velocity.x + velocity.y * velocity.y - projectileSpeed * projectileSpeed;
  const b = 2 * (relativeX * velocity.x + relativeY * velocity.y);
  const c = relativeX * relativeX + relativeY * relativeY;
  let time = 0;

  if (Math.abs(a) < 0.0001) {
    if (Math.abs(b) > 0.0001) time = -c / b;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      const first = (-b - root) / (2 * a);
      const second = (-b + root) / (2 * a);
      const positive = [first, second].filter((candidate) => candidate > 0);
      if (positive.length > 0) time = Math.min(...positive);
    }
  }

  const clampedTime = Math.max(0, Math.min(1.5, time));
  return {
    x: target.x + velocity.x * clampedTime,
    y: target.y + velocity.y * clampedTime,
  };
}
