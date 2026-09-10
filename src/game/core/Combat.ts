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
