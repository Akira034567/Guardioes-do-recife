import { describe, expect, it } from "vitest";
import {
  allArtVariants,
  artFolder,
  artKindsFor,
  artPath,
  artTextureFor,
  artTextureKey,
  GUARDIAN_ART,
  GUARDIAN_ART_ASSETS,
} from "../src/game/assets/guardianArt";
import { RECIFE_ONE_BACKGROUND_KEY, RECIFE_ONE_IMAGE_ASSETS } from "../src/game/assets/recifeOneAssets";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";
import type { GuardianId } from "../src/game/types";

// Arquivos existentes em `public/assets/guardians/<pasta>/<variante>/` (PNGs e os `.gitkeep` das pastas vazias),
// enumerados pelo Vite no momento da transformação.
const filesOnDisk = new Set(
  [
    ...Object.keys(import.meta.glob("/public/assets/guardians/*/*/*.png")),
    ...Object.keys(import.meta.glob("/public/assets/guardians/*/*/.gitkeep")),
  ].map((path) => path.replace("/public/", "")),
);
const foldersOnDisk = new Set([...filesOnDisk].map((path) => path.slice(0, path.lastIndexOf("/"))));
const onDisk = (path: string): boolean => filesOnDisk.has(path) || foldersOnDisk.has(path);

describe("guardian art registry", () => {
  it("covers every guardian with a base variant and two upgrades per branch", () => {
    GUARDIAN_ORDER.forEach((id) => {
      const profile = GUARDIAN_ART[id];
      expect(profile.branches.a).toHaveLength(2);
      expect(profile.branches.b).toHaveLength(2);
      expect(allArtVariants(id)).toHaveLength(5);
      expect(new Set(allArtVariants(id).map((variant) => variant.folder)).size).toBe(5);
      expect(profile.scale).toBeGreaterThan(0);
    });
  });

  it("registers one unique image per guardian × variant × kind", () => {
    const expected = GUARDIAN_ORDER.reduce((total, id) => total + 5 * artKindsFor(id).length, 0);
    expect(GUARDIAN_ART_ASSETS).toHaveLength(expected);
    expect(new Set(GUARDIAN_ART_ASSETS.map((asset) => asset.key)).size).toBe(GUARDIAN_ART_ASSETS.length);
    expect(new Set(GUARDIAN_ART_ASSETS.map((asset) => asset.path)).size).toBe(GUARDIAN_ART_ASSETS.length);
  });

  it("uses the spec folders and file names for the new guardians", () => {
    expect(artFolder("shark")).toBe("tubarao");
    expect(artFolder("sea-turtle")).toBe("tartaruga");
    expect(artFolder("stonefish")).toBe("peixe_pedra");
    expect(artFolder("dolphin")).toBe("golfinho");
    expect(artFolder("pistol-shrimp")).toBe("pistol-shrimp");
    expect(allArtVariants("shark").map((variant) => variant.folder)).toEqual(["base", "frenesi_1", "frenesi_2", "alfa_1", "alfa_2"]);
    expect(allArtVariants("sea-turtle").map((variant) => variant.folder)).toEqual(["base", "casco_1", "casco_2", "corrente_1", "corrente_2"]);
    expect(allArtVariants("stonefish").map((variant) => variant.folder)).toEqual(["base", "veneno_1", "veneno_2", "emboscada_1", "emboscada_2"]);
    expect(allArtVariants("dolphin").map((variant) => variant.folder)).toEqual(["base", "coro_1", "coro_2", "sonar_1", "sonar_2"]);
    expect(artPath("shark", GUARDIAN_ART.shark.branches.a[0], "projectile")).toBe("assets/guardians/tubarao/frenesi_1/ability.png");
    expect(artPath("pistol-shrimp", GUARDIAN_ART["pistol-shrimp"].base, "projectile")).toBe("assets/guardians/pistol-shrimp/base/projectile.png");
    expect(artKindsFor("shark")).toEqual(["idle", "attack", "projectile", "impact", "portrait"]);
    expect(artKindsFor("jellyfish")).toEqual(["idle", "attack", "projectile", "impact", "portrait"]);
  });

  it("has every variant folder on disk, and every file for guardians whose art already arrived", () => {
    GUARDIAN_ORDER.forEach((id) => {
      const profile = GUARDIAN_ART[id];
      allArtVariants(id).forEach((variant) => {
        expect(onDisk(`assets/guardians/${artFolder(id)}/${variant.folder}`), `${id}/${variant.folder} folder`).toBe(true);
      });
      const ready = onDisk(artPath(id, profile.base, "idle"));
      if (!ready) return;
      const missing = GUARDIAN_ART_ASSETS.filter((asset) => asset.guardianId === id && !onDisk(asset.path));
      expect(missing.map((asset) => asset.path), `${id} files`).toEqual([]);
    });
  });

  it("resolves the base variant until the first upgrade, then the branch variant clamped to level two", () => {
    expect(artTextureFor("pistol-shrimp", { branchId: null, upgradeLevel: 0 }, "idle")).toBe("pistol-shrimp-base-idle");
    expect(artTextureFor("pistol-shrimp", { branchId: "a", upgradeLevel: 0 }, "idle")).toBe("pistol-shrimp-base-idle");
    expect(artTextureFor("pistol-shrimp", { branchId: "a", upgradeLevel: 1 }, "attack")).toBe("pistol-shrimp-perfuracao-1-attack");
    expect(artTextureFor("pistol-shrimp", { branchId: "b", upgradeLevel: 2 }, "projectile")).toBe("pistol-shrimp-impacto-2-projectile");
    expect(artTextureFor("reef-crab", { branchId: "b", upgradeLevel: 99 }, "impact")).toBe("reef-crab-area-2-impact");
    expect(artTextureFor("ink-octopus", { branchId: "a", upgradeLevel: 2 }, "portrait")).toBe("ink-octopus-debuff-2-portrait");
    expect(artTextureFor("shark", { branchId: "b", upgradeLevel: 2 }, "idle")).toBe("shark-alfa_2-idle");
    expect(artTextureFor("stonefish", { branchId: "a", upgradeLevel: 1 }, "attack")).toBe("stonefish-veneno_1-attack");
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
