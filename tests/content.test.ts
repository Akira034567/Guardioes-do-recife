import { describe, expect, it } from "vitest";
import { GUARDIANS } from "../src/game/data/guardians";
import { RECIFE_ONE } from "../src/game/data/recifeOne";
import { RoutePath } from "../src/game/core/RoutePath";
import {
  RECIFE_ONE_BACKGROUND_KEY,
  RECIFE_ONE_IMAGE_ASSETS,
  SHRIMP_TEXTURES,
  shrimpProjectileTextureForLevel,
} from "../src/game/assets/recifeOneAssets";

describe("Recife 1 content contracts", () => {
  it("keeps five waves and four shrimp platforms", () => {
    expect(RECIFE_ONE.waves).toHaveLength(5);
    expect(RECIFE_ONE.placements).toHaveLength(4);
    expect("routePlacements" in RECIFE_ONE).toBe(false);
  });

  it("assigns distinct placement rules and two linear upgrades", () => {
    expect(GUARDIANS["pistol-shrimp"].placementMode).toBe("platform");
    expect(GUARDIANS.jellyfish.placementMode).toBe("water");
    expect(GUARDIANS.pufferfish.placementMode).toBe("route");
    Object.values(GUARDIANS).forEach((guardian) => expect(guardian.upgrades).toHaveLength(2));
  });

  it("places the upper-left shrimp platform within attack range but outside the route", () => {
    const route = new RoutePath(RECIFE_ONE.waypoints);
    const platform = RECIFE_ONE.placements.find((candidate) => candidate.id === "coral-norte");
    expect(platform).toBeDefined();
    const distance = route.getClosestPoint(platform!).distance;
    expect(distance).toBeLessThan(GUARDIANS["pistol-shrimp"].range);
    expect(distance).toBeGreaterThan(82);
  });

  it("uses the refined puffer pulse and the limited electric field", () => {
    expect(GUARDIANS.pufferfish.damage).toBe(15);
    expect(GUARDIANS.pufferfish.range).toBe(112);
    const field = GUARDIANS.jellyfish.upgrades[1].electricField;
    expect(field).toMatchObject({ durationMs: 2500, cooldownMs: 5000 });
  });

  it("maps one shrimp projectile image to each upgrade level", () => {
    expect(SHRIMP_TEXTURES.idle).toHaveLength(3);
    expect(SHRIMP_TEXTURES.attack).toHaveLength(3);
    expect(SHRIMP_TEXTURES.projectile).toHaveLength(3);
    expect([0, 1, 2].map(shrimpProjectileTextureForLevel)).toEqual(SHRIMP_TEXTURES.projectile);
    expect(shrimpProjectileTextureForLevel(99)).toBe(SHRIMP_TEXTURES.projectile[2]);
  });

  it("registers the level artwork and every shrimp runtime image", () => {
    const keys = RECIFE_ONE_IMAGE_ASSETS.map((asset) => asset.key);
    expect(keys).toContain(RECIFE_ONE_BACKGROUND_KEY);
    expect(new Set(keys).size).toBe(keys.length);
    expect(RECIFE_ONE_IMAGE_ASSETS).toHaveLength(10);
  });
});
