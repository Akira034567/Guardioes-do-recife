import { describe, expect, it } from "vitest";
import { ProjectileCore, type ProjectileConfig, type ProjectileTarget } from "../src/game/core/ProjectileCore";

const baseConfig = (overrides: Partial<ProjectileConfig> = {}): ProjectileConfig => ({
  speed: 400,
  damages: [20],
  predictiveAim: false,
  straightRicochet: false,
  ricochetRange: 240,
  radius: 6,
  lifetimeMs: 2200,
  bounds: { minX: -80, maxX: 1360, minY: -80, maxY: 800 },
  ...overrides,
});

const target = (id: string, x: number, y: number, extra: Partial<ProjectileTarget> = {}): ProjectileTarget => ({
  id,
  x,
  y,
  hitRadius: 14,
  velocity: { x: 0, y: 0 },
  alive: true,
  ...extra,
});

const runUntil = (
  projectile: ProjectileCore,
  targets: ProjectileTarget[],
  maxSteps = 400,
): { hits: Array<{ targetId: string; damage: number; splash: boolean }>; expired: boolean; steps: number } => {
  const hits: Array<{ targetId: string; damage: number; splash: boolean }> = [];
  for (let step = 1; step <= maxSteps; step += 1) {
    const result = projectile.step(16, targets);
    hits.push(...result.hits);
    if (result.expired) return { hits, expired: true, steps: step };
  }
  return { hits, expired: false, steps: maxSteps };
};

describe("shrimp projectile", () => {
  it("never hits the same enemy twice even when it stays on the path", () => {
    const enemy = target("A", 120, 0);
    const projectile = new ProjectileCore({ x: 0, y: 0 }, enemy, baseConfig({ damages: [20, 15] }));
    const { hits, expired } = runUntil(projectile, [enemy]);
    expect(hits.filter((hit) => hit.targetId === "A")).toHaveLength(1);
    expect(hits[0].damage).toBe(20);
    expect(expired).toBe(true);
    expect(projectile.hitCount).toBe(1);
  });

  it("pierces a second distinct enemy with the second damage value", () => {
    const first = target("A", 100, 0);
    const second = target("B", 220, 0);
    const projectile = new ProjectileCore({ x: 0, y: 0 }, first, baseConfig({ damages: [20, 15] }));
    const { hits, expired } = runUntil(projectile, [first, second]);
    expect(hits.map((hit) => [hit.targetId, hit.damage])).toEqual([
      ["A", 20],
      ["B", 15],
    ]);
    expect(expired).toBe(true);
  });

  it("ricochets in a straight line to the nearest fresh target after each pierce", () => {
    const first = target("A", 100, 0);
    const second = target("B", 180, 90);
    const third = target("C", 260, 0);
    const projectile = new ProjectileCore(
      { x: 0, y: 0 },
      first,
      baseConfig({ damages: [24, 19, 15], straightRicochet: true }),
    );
    const hitsSoFar: string[] = [];
    let expired = false;
    for (let step = 0; step < 400 && !expired; step += 1) {
      const result = projectile.step(16, [first, second, third]);
      result.hits.forEach((hit) => hitsSoFar.push(`${hit.targetId}:${hit.damage}`));
      if (hitsSoFar.length === 1) {
        const angle = Math.atan2(projectile.velocityY, projectile.velocityX);
        const expected = Math.atan2(second.y - projectile.y, second.x - projectile.x);
        expect(Math.abs(angle - expected)).toBeLessThan(1e-6);
        expect(projectile.homing).toBe(false);
        expect(projectile.targetId).toBe("B");
      }
      expired = result.expired;
    }
    expect(hitsSoFar).toEqual(["A:24", "B:19", "C:15"]);
    expect(expired).toBe(true);
  });

  it("does not chase targets beyond the ricochet range", () => {
    const first = target("A", 100, 0);
    const far = target("B", 900, 500);
    const projectile = new ProjectileCore(
      { x: 0, y: 0 },
      first,
      baseConfig({ damages: [24, 19, 15], straightRicochet: true, lifetimeMs: 600 }),
    );
    const { hits, expired } = runUntil(projectile, [first, far]);
    expect(hits).toHaveLength(1);
    expect(projectile.targetId).toBeNull();
    expect(expired).toBe(true);
  });

  it("applies splash once per neighbour and marks them as already hit", () => {
    const primary = target("A", 120, 0);
    const neighbour = target("B", 140, 30);
    const projectile = new ProjectileCore(
      { x: 0, y: 0 },
      primary,
      baseConfig({ damages: [50], splash: { radius: 42, damageMultiplier: 0.45 } }),
    );
    const { hits, expired } = runUntil(projectile, [primary, neighbour]);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({ targetId: "A", damage: 50, splash: false });
    expect(hits[1]).toEqual({ targetId: "B", damage: 22.5, splash: true });
    expect(projectile.hitIds.has("B")).toBe(true);
    expect(expired).toBe(true);
  });

  it("ignores dead targets and expires when leaving the bounds", () => {
    const dead = target("A", 100, 0, { alive: false });
    const projectile = new ProjectileCore({ x: 0, y: 0 }, dead, baseConfig({ lifetimeMs: 10_000 }));
    const { hits, expired } = runUntil(projectile, [dead], 1000);
    expect(hits).toEqual([]);
    expect(expired).toBe(true);
    expect(projectile.x).toBeGreaterThan(1360);
  });
});
