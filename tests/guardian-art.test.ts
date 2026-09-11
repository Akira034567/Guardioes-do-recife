import { describe, expect, it } from "vitest";
import {
  allArtVariants,
  ART_KINDS,
  artTextureFor,
  artTextureKey,
  GUARDIAN_ART,
  GUARDIAN_ART_ASSETS,
} from "../src/game/assets/guardianArt";
import { RECIFE_ONE_BACKGROUND_KEY, RECIFE_ONE_IMAGE_ASSETS } from "../src/game/assets/recifeOneAssets";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";
import type { GuardianId } from "../src/game/types";

describe("guardian art registry", () => {
  it("covers every guardian with a base variant and two upgrades per branch", () => {
    GUARDIAN_ORDER.forEach((id) => {
      const profile = GUARDIAN_ART[id];
      expect(profile.branches.a).toHaveLength(2);
      expect(profile.branches.b).toHaveLength(2);
      expect(allArtVariants(id)).toHaveLength(5);
      expect(profile.scale).toBeGreaterThan(0);
    });
  });

  it("registers 125 unique images and every file exists under public/", () => {
    expect(GUARDIAN_ART_ASSETS).toHaveLength(GUARDIAN_ORDER.length * 5 * ART_KINDS.length);
    expect(new Set(GUARDIAN_ART_ASSETS.map((asset) => asset.key)).size).toBe(GUARDIAN_ART_ASSETS.length);
    const onDisk = new Set(Object.keys(import.meta.glob("/public/assets/guardians/*/*/*.png")).map((path) => path.replace("/public/", "")));
    const missing = GUARDIAN_ART_ASSETS.filter((asset) => !onDisk.has(asset.path));
    expect(missing.map((asset) => asset.path)).toEqual([]);
  });

  it("resolves the base variant until the first upgrade, then the branch variant clamped to level two", () => {
    expect(artTextureFor("pistol-shrimp", { branchId: null, upgradeLevel: 0 }, "idle")).toBe("pistol-shrimp-base-idle");
    expect(artTextureFor("pistol-shrimp", { branchId: "a", upgradeLevel: 0 }, "idle")).toBe("pistol-shrimp-base-idle");
    expect(artTextureFor("pistol-shrimp", { branchId: "a", upgradeLevel: 1 }, "attack")).toBe("pistol-shrimp-perfuracao-1-attack");
    expect(artTextureFor("pistol-shrimp", { branchId: "b", upgradeLevel: 2 }, "projectile")).toBe("pistol-shrimp-impacto-2-projectile");
    expect(artTextureFor("reef-crab", { branchId: "b", upgradeLevel: 99 }, "impact")).toBe("reef-crab-area-2-impact");
    expect(artTextureFor("ink-octopus", { branchId: "a", upgradeLevel: 2 }, "portrait")).toBe("ink-octopus-debuff-2-portrait");
  });

  it("keeps idle and attack as distinct images for every variant", () => {
    (Object.keys(GUARDIAN_ART) as GuardianId[]).forEach((id) => {
      allArtVariants(id).forEach((variant) => {
        expect(artTextureKey(id, variant, "idle")).not.toBe(artTextureKey(id, variant, "attack"));
      });
    });
  });

  it("loads the level background together with the guardian art", () => {
    const keys = RECIFE_ONE_IMAGE_ASSETS.map((asset) => asset.key);
    expect(keys).toContain(RECIFE_ONE_BACKGROUND_KEY);
    expect(new Set(keys).size).toBe(keys.length);
    expect(RECIFE_ONE_IMAGE_ASSETS).toHaveLength(GUARDIAN_ART_ASSETS.length + 1);
  });
});
