import { describe, expect, it } from "vitest";
import { RoutePath } from "../src/game/core/RoutePath";

describe("RoutePath", () => {
  const route = new RoutePath([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]);

  it("interpolates distance across segments", () => {
    expect(route.totalLength).toBe(200);
    expect(route.getPointAtDistance(50)).toEqual({ x: 50, y: 0 });
    expect(route.getPointAtDistance(150)).toEqual({ x: 100, y: 50 });
  });

  it("clamps distance and reports normalized progress", () => {
    expect(route.getPointAtDistance(-20)).toEqual({ x: 0, y: 0 });
    expect(route.getPointAtDistance(500)).toEqual({ x: 100, y: 100 });
    expect(route.getProgress(50)).toBe(0.25);
    expect(route.getProgress(999)).toBe(1);
  });

  it("finds the nearest point and distance from the route", () => {
    expect(route.getClosestPoint({ x: 40, y: 30 })).toMatchObject({
      point: { x: 40, y: 0 },
      distance: 30,
      routeDistance: 40,
      progress: 0.2,
    });
  });

  it("rejects invalid routes", () => {
    expect(() => new RoutePath([{ x: 0, y: 0 }])).toThrow();
    expect(() => new RoutePath([{ x: 1, y: 1 }, { x: 1, y: 1 }])).toThrow();
  });
});
