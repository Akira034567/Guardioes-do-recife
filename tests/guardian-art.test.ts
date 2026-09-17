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
  GUARDIAN_BASE_ART_ASSETS,
  guardianUpgradeArtAssets,
  strikeFrameKeys,
  strikeFramePath,
} from "../src/game/assets/guardianArt";
import { RECIFE_ONE_BACKGROUND_KEY, RECIFE_ONE_IMAGE_ASSETS } from "../src/game/assets/recifeOneAssets";
import type { GuardianId } from "../src/game/types";
import { GUARDIAN_ORDER } from "../src/game/data/guardians";

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

  it("registers one unique image per guardian × variant × kind, plus the strike frames", () => {
    const poses = GUARDIAN_ORDER.reduce((total, id) => total + 5 * artKindsFor(id).length, 0);
    const frames = GUARDIAN_ORDER.reduce(
      (total, id) => total + allArtVariants(id).reduce((sum, variant) => sum + (variant.strikeFrames ?? 0), 0),
      0,
    );
    expect(GUARDIAN_ART_ASSETS).toHaveLength(poses + frames);
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

  it("numbers the strike frames from one and keeps them next to the static pose", () => {
    const coroTwo = GUARDIAN_ART.dolphin.branches.a[1];
    expect(coroTwo.strikeFrames).toBe(10);
    const keys = strikeFrameKeys("dolphin", coroTwo);
    expect(keys[0]).toBe("dolphin-coro_2-attack-1");
    expect(keys.at(-1)).toBe("dolphin-coro_2-attack-10");
    expect(strikeFramePath("dolphin", coroTwo, 1)).toBe("assets/guardians/golfinho/coro_2/attack-1.png");
    keys.forEach((key, index) => expect(onDisk(strikeFramePath("dolphin", coroTwo, index + 1)), key).toBe(true));
    // A pose estática continua em disco: é ela que aparece enquanto os quadros não carregaram.
    expect(onDisk(artPath("dolphin", coroTwo, "attack"))).toBe(true);
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
    // Dieta do boot (item 45): só a forma base de cada Guardião entra antes do menu.
    expect(RECIFE_ONE_IMAGE_ASSETS).toHaveLength(GUARDIAN_BASE_ART_ASSETS.length + 1);
    expect(GUARDIAN_BASE_ART_ASSETS.length).toBeLessThan(GUARDIAN_ART_ASSETS.length / 4);
  });

  it("splits the base art from the upgrade art without losing an image", () => {
    const squad: GuardianId[] = ["pistol-shrimp", "jellyfish", "pufferfish", "reef-crab", "ink-octopus"];
    const upgrades = guardianUpgradeArtAssets(squad);
    // Nenhuma imagem do esquadrão fica de fora entre boot e partida, e nada é carregado duas vezes.
    const squadArt = GUARDIAN_ART_ASSETS.filter((asset) => squad.includes(asset.guardianId));
    const squadBase = GUARDIAN_BASE_ART_ASSETS.filter((asset) => squad.includes(asset.guardianId));
    expect(upgrades.length + squadBase.length).toBe(squadArt.length);
    expect(upgrades.some((asset) => squadBase.some((base) => base.key === asset.key))).toBe(false);
    // Guardião fora do esquadrão não entra na partida.
    expect(upgrades.some((asset) => asset.key.startsWith("shark-"))).toBe(false);
  });
});
