import { describe, expect, it } from "vitest";
import { aliveInShape, LEGACY_TARGETING, normalizeStrategy, selectTarget, type TargetCandidate } from "../src/game/core/Targeting";
import { RADIAL, shapeContains, shapeOutline, type TargetingShape } from "../src/game/core/TargetingShape";
import { GUARDIANS } from "../src/game/data/guardians";
import { resolveGuardianStats } from "../src/game/core/GuardianStats";

function candidate(id: string, overrides: Partial<TargetCandidate> = {}): TargetCandidate {
  return {
    id,
    x: 0,
    y: 0,
    progress: 0.5,
    health: 50,
    dead: false,
    reachedGoal: false,
    definition: { role: "common", maxHealth: 100 },
    ...overrides,
  };
}

const origin = { x: 0, y: 0, facingRad: 0, routeDistance: 500, pathId: "main" };

describe("targeting shapes", () => {
  it("keeps radial identical to the plain range check", () => {
    expect(shapeContains(RADIAL, origin, 100, { x: 100, y: 0 })).toBe(true);
    expect(shapeContains(RADIAL, origin, 100, { x: 101, y: 0 })).toBe(false);
    expect(shapeOutline(RADIAL, origin, 100)).toEqual({ kind: "circle", x: 0, y: 0, radius: 100 });
  });

  it("limits a cone by angle and range", () => {
    const cone: TargetingShape = { kind: "cone", angleDeg: 90, facing: "fixed", facingDeg: 0 };
    expect(shapeContains(cone, origin, 100, { x: 50, y: 0 })).toBe(true);
    expect(shapeContains(cone, origin, 100, { x: 50, y: 49 }), "dentro dos 45° para cada lado").toBe(true);
    expect(shapeContains(cone, origin, 100, { x: 10, y: 80 }), "fora do setor").toBe(false);
    expect(shapeContains(cone, origin, 100, { x: -50, y: 0 }), "atrás da unidade").toBe(false);
    expect(shapeContains(cone, origin, 100, { x: 200, y: 0 }), "além do alcance").toBe(false);
    const outline = shapeOutline(cone, origin, 100);
    expect(outline.kind).toBe("polygon");
  });

  it("limits a line by width and length", () => {
    const line: TargetingShape = { kind: "line", width: 40, facing: "fixed", facingDeg: 90 };
    expect(shapeContains(line, origin, 100, { x: 0, y: 50 })).toBe(true);
    expect(shapeContains(line, origin, 100, { x: 19, y: 50 })).toBe(true);
    expect(shapeContains(line, origin, 100, { x: 21, y: 50 })).toBe(false);
    expect(shapeContains(line, origin, 100, { x: 0, y: -10 }), "para trás não conta").toBe(false);
  });

  it("measures the route window in path distance and respects the path id", () => {
    const route: TargetingShape = { kind: "route", behind: 30, ahead: 60 };
    expect(shapeContains(route, origin, 100, { x: 999, y: 999, pathDistance: 520, pathId: "main" })).toBe(true);
    expect(shapeContains(route, origin, 100, { x: 0, y: 0, pathDistance: 480, pathId: "main" })).toBe(true);
    expect(shapeContains(route, origin, 100, { x: 0, y: 0, pathDistance: 440, pathId: "main" })).toBe(false);
    expect(shapeContains(route, origin, 100, { x: 0, y: 0, pathDistance: 520, pathId: "leste" }), "outra rota").toBe(false);
    expect(shapeContains(route, { x: 0, y: 0, routeDistance: null }, 100, { x: 0, y: 0, pathDistance: 520 })).toBe(false);
  });

  it("lets the global shape ignore range entirely", () => {
    expect(shapeContains({ kind: "global" }, origin, 10, { x: 9999, y: 9999 })).toBe(true);
    expect(shapeOutline({ kind: "global" }, origin, 10)).toEqual({ kind: "none" });
  });

  it("skips hidden enemies until they are revealed", () => {
    const hidden = candidate("E1", { x: 10, isTargetable: () => false });
    const visible = candidate("E2", { x: 20 });
    expect(aliveInShape([hidden, visible], origin, 100, RADIAL, 0).map((entry) => entry.id)).toEqual(["E2"]);
  });
});

describe("targeting strategies", () => {
  const pool = [
    candidate("first", { x: 10, progress: 0.9, health: 80, definition: { role: "common", maxHealth: 100 } }),
    candidate("last", { x: 80, progress: 0.1, health: 10, definition: { role: "fast", maxHealth: 40 } }),
    candidate("elite", { x: 40, progress: 0.5, health: 200, definition: { role: "elite", maxHealth: 250, tags: ["ELITE"] } }),
    candidate("boss", { x: 60, progress: 0.3, health: 500, definition: { role: "boss", isBoss: true, maxHealth: 600 } }),
  ];
  const pick = (mode: Parameters<typeof normalizeStrategy>[0]): string | undefined => selectTarget(pool, origin, 500, { mode })?.id;

  it("maps the four legacy modes onto the new strategies", () => {
    expect(LEGACY_TARGETING).toEqual({ leading: "FIRST", lowestHealth: "LOWEST_HEALTH", wounded: "WOUNDED", threat: "THREAT" });
    expect(pick("leading")).toBe(pick("FIRST"));
    expect(pick("lowestHealth")).toBe(pick("LOWEST_HEALTH"));
    expect(pick("threat")).toBe(pick("THREAT"));
  });

  it("orders by each strategy", () => {
    expect(pick("FIRST")).toBe("first");
    expect(pick("LAST")).toBe("last");
    expect(pick("CLOSEST")).toBe("first");
    expect(pick("FARTHEST")).toBe("last");
    expect(pick("STRONGEST")).toBe("boss");
    expect(pick("WEAKEST")).toBe("last");
    expect(pick("LOWEST_HEALTH")).toBe("last");
    expect(pick("HIGHEST_HEALTH")).toBe("boss");
    expect(pick("ELITE")).toBe("elite");
    expect(pick("BOSS")).toBe("boss");
    expect(pick("THREAT")).toBe("boss");
  });

  it("prefers a marked enemy with MARKED and falls back to progress", () => {
    const marked = candidate("marked", { x: 30, progress: 0.2, status: { isMarked: () => true } });
    const plain = candidate("plain", { x: 30, progress: 0.8, status: { isMarked: () => false } });
    expect(selectTarget([plain, marked], origin, 500, { mode: "MARKED" })?.id).toBe("marked");
    expect(selectTarget([plain], origin, 500, { mode: "MARKED" })?.id).toBe("plain");
  });

  it("still honours the coordinated and marked overrides before the strategy", () => {
    expect(selectTarget(pool, origin, 500, { mode: "FIRST", preferredId: "boss" })?.id).toBe("boss");
    expect(selectTarget(pool, origin, 500, { mode: "FIRST", markedId: "elite" })?.id).toBe("elite");
    expect(selectTarget(pool, origin, 500, { mode: "FIRST", preferredId: "fantasma" })?.id, "alvo ausente não trava a escolha").toBe("first");
  });

  it("applies the shape before the strategy", () => {
    const behind = candidate("atras", { x: -100, progress: 0.99 });
    const ahead = candidate("frente", { x: 100, progress: 0.1 });
    const cone: TargetingShape = { kind: "cone", angleDeg: 60, facing: "fixed", facingDeg: 0 };
    expect(selectTarget([behind, ahead], origin, 500, { mode: "FIRST", shape: cone })?.id).toBe("frente");
  });
});

describe("guardian shapes", () => {
  it("keeps every current guardian radial", () => {
    for (const definition of Object.values(GUARDIANS)) {
      const stats = resolveGuardianStats(definition, { branchId: null, upgradeLevel: 0 });
      expect(stats.targetingShape, `${definition.id} deve continuar radial`).toEqual(RADIAL);
      for (const branch of definition.branches) {
        for (let level = 1; level <= branch.upgrades.length; level += 1) {
          expect(resolveGuardianStats(definition, { branchId: branch.id, upgradeLevel: level }).targetingShape).toEqual(RADIAL);
        }
      }
    }
  });
});
