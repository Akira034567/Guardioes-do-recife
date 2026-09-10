import type Phaser from "phaser";

export const RECIFE_ONE_BACKGROUND_KEY = "recife-one-background";

export type ShrimpVisualState = "idle" | "attack";

export const SHRIMP_LEVEL_TEXTURES = [
  {
    idle: "shrimp-level-0-idle",
    attack: "shrimp-level-0-attack",
    projectile: "shrimp-level-0-projectile",
  },
  {
    idle: "shrimp-level-1-idle",
    attack: "shrimp-level-1-attack",
    projectile: "shrimp-level-1-projectile",
  },
  {
    idle: "shrimp-level-2-idle",
    attack: "shrimp-level-2-attack",
    projectile: "shrimp-level-2-projectile",
  },
] as const;

export const RECIFE_ONE_IMAGE_ASSETS: ReadonlyArray<{ key: string; path: string }> = [
  { key: RECIFE_ONE_BACKGROUND_KEY, path: "assets/levels/recife-one/background.png" },
  ...SHRIMP_LEVEL_TEXTURES.flatMap((textures, level) => [
    { key: textures.idle, path: `assets/guardians/pistol-shrimp/level-${level}/idle.png` },
    { key: textures.attack, path: `assets/guardians/pistol-shrimp/level-${level}/attack.png` },
    { key: textures.projectile, path: `assets/guardians/pistol-shrimp/level-${level}/projectile.png` },
  ]),
];

export function preloadRecifeOneAssets(scene: Phaser.Scene): void {
  RECIFE_ONE_IMAGE_ASSETS.forEach(({ key, path }) => scene.load.image(key, path));
}

export function shrimpTextureForLevel(upgradeLevel: number, state: ShrimpVisualState): string {
  return SHRIMP_LEVEL_TEXTURES[normalizeShrimpLevel(upgradeLevel)][state];
}

export function shrimpProjectileTextureForLevel(upgradeLevel: number): string {
  return SHRIMP_LEVEL_TEXTURES[normalizeShrimpLevel(upgradeLevel)].projectile;
}

function normalizeShrimpLevel(upgradeLevel: number): 0 | 1 | 2 {
  return Math.max(0, Math.min(Math.floor(upgradeLevel), SHRIMP_LEVEL_TEXTURES.length - 1)) as 0 | 1 | 2;
}
