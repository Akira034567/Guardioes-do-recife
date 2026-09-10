import { describe, expect, it } from "vitest";
import { GUARDIANS } from "../src/game/data/guardians";
import { RECIFE_ONE } from "../src/game/data/recifeOne";
import { RoutePath } from "../src/game/core/RoutePath";
import {
  RECIFE_ONE_BACKGROUND_KEY,
  RECIFE_ONE_IMAGE_ASSETS,
  SHRIMP_LEVEL_TEXTURES,
  shrimpProjectileTextureForLevel,
  shrimpTextureForLevel,
} from "../src/game/assets/recifeOneAssets";
import { containsPoint } from "../src/game/core/CurrentField";

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
    const platform = RECIFE_ONE.placements.find((candidate) => candidate.id === "anemona-norte");
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
    expect(SHRIMP_LEVEL_TEXTURES).toHaveLength(3);
    SHRIMP_LEVEL_TEXTURES.forEach((textures, level) => {
      expect(shrimpTextureForLevel(level, "idle")).toBe(textures.idle);
      expect(shrimpTextureForLevel(level, "attack")).toBe(textures.attack);
      expect(shrimpProjectileTextureForLevel(level)).toBe(textures.projectile);
      expect(textures.idle).not.toBe(textures.attack);
    });
    expect(shrimpProjectileTextureForLevel(99)).toBe(SHRIMP_LEVEL_TEXTURES[2].projectile);
  });

  it("registers the level artwork and every shrimp runtime image", () => {
    const keys = RECIFE_ONE_IMAGE_ASSETS.map((asset) => asset.key);
    expect(keys).toContain(RECIFE_ONE_BACKGROUND_KEY);
    expect(new Set(keys).size).toBe(keys.length);
    expect(RECIFE_ONE_IMAGE_ASSETS).toHaveLength(10);
  });

  it("aligns platforms and the active current to the painted landmarks", () => {
    expect(RECIFE_ONE.placements).toEqual([
      { id: "anemona-norte", x: 350, y: 255 },
      { id: "estrela-sul", x: 490, y: 510 },
      { id: "concha-norte", x: 750, y: 145 },
      { id: "coral-cerebro-sul", x: 925, y: 510 },
    ]);
    const current = RECIFE_ONE.currents[0];
    RECIFE_ONE.waypoints
      .filter((point) => point.x >= current.x && point.x <= current.x + current.width)
      .forEach((point) => expect(containsPoint(current, point)).toBe(true));
  });
});
