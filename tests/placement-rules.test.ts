import { describe, expect, it } from "vitest";
import { validateMarginPlacement, validatePlacement, validateRoutePlacement, validateWaterPlacement } from "../src/game/core/PlacementRules";
import { RoutePath } from "../src/game/core/RoutePath";
import { PLACEMENT } from "../src/game/data/balance";
import { RECIFE_ONE } from "../src/game/data/levels";
import { branchStatuses } from "../src/game/core/UpgradeTree";
import { GUARDIANS } from "../src/game/data/guardians";

const route = new RoutePath(RECIFE_ONE.waypoints);
const context = { route, platforms: RECIFE_ONE.placements, guardians: [] as { x: number; y: number }[], routeUnits: [] as { x: number; y: number }[] };

describe("placement rules", () => {
  it("accepts the margin band only between marginMin and marginMax from the route", () => {
    const onRoute = route.getPointAtDistance(500);
    expect(validateMarginPlacement(context, onRoute).reason).toMatch(/beira/);
    const nearby = { x: 300, y: 470 };
    const distance = route.getClosestPoint(nearby).distance;
    expect(distance).toBeGreaterThan(PLACEMENT.marginMin);
    expect(distance).toBeLessThan(PLACEMENT.marginMax);
    expect(validateMarginPlacement(context, nearby).valid).toBe(true);
    expect(validateMarginPlacement(context, { x: 300, y: 540 }).reason).toMatch(/Longe/);
    expect(validateMarginPlacement({ ...context, guardians: [{ x: 310, y: 480 }] }, nearby).reason).toMatch(/outro Guardião/);
    expect(validateMarginPlacement(context, { x: 500, y: 440 }).reason).toMatch(/Plataforma/);
  });

  it("keeps the water and route rules unchanged", () => {
    expect(validateWaterPlacement(context, { x: 245, y: 255 }).valid).toBe(true);
    expect(validateWaterPlacement(context, { x: 330, y: 430 }).reason).toBe("Muito perto da rota");
    const snapped = validateRoutePlacement(context, { x: 330, y: 400 });
    expect(snapped.valid).toBe(true);
    expect(snapped.routeDistance).not.toBeNull();
    expect(route.getClosestPoint({ x: snapped.x, y: snapped.y }).distance).toBeLessThan(1);
    expect(validateRoutePlacement(context, { x: 10, y: 315 }).reason).toMatch(/entrada/);
    expect(validateRoutePlacement({ ...context, routeUnits: [{ x: snapped.x, y: snapped.y }] }, { x: 340, y: 400 }).reason).toMatch(/correnteza/);
    expect(validatePlacement("margin", context, { x: 300, y: 470 }).valid).toBe(true);
  });
});

describe("branch statuses for the upgrade panel", () => {
  it("offers both branches, then locks the other one and completes the chosen one", () => {
    const shark = GUARDIANS.shark;
    expect(branchStatuses(shark, { branchId: null, upgradeLevel: 0 }).map((branch) => branch.state)).toEqual(["available", "available"]);
    const chosen = branchStatuses(shark, { branchId: "a", upgradeLevel: 1 });
    expect(chosen.map((branch) => branch.state)).toEqual(["chosen", "locked"]);
    expect(chosen[0].steps.map((step) => step.purchased)).toEqual([true, false]);
    expect(chosen[1].steps.every((step) => !step.purchased)).toBe(true);
    const done = branchStatuses(shark, { branchId: "b", upgradeLevel: 2 });
    expect(done.map((branch) => branch.state)).toEqual(["locked", "complete"]);
    expect(done[1].name).toBe("Investida");
  });
});
