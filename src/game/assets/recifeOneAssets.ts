import type Phaser from "phaser";

export const RECIFE_ONE_BACKGROUND_KEY = "recife-one-background";

export const SHRIMP_TEXTURES = {
  idle: ["shrimp-idle-01", "shrimp-idle-02", "shrimp-idle-03"],
  attack: ["shrimp-attack-01", "shrimp-attack-02", "shrimp-attack-03"],
  projectile: ["shrimp-projectile-00", "shrimp-projectile-01", "shrimp-projectile-02"],
} as const;

export const RECIFE_ONE_IMAGE_ASSETS: ReadonlyArray<{ key: string; path: string }> = [
  { key: RECIFE_ONE_BACKGROUND_KEY, path: "assets/levels/recife-one/background.png" },
  ...SHRIMP_TEXTURES.idle.map((key, index) => ({
    key,
    path: `assets/guardians/pistol-shrimp/idle/idle-0${index + 1}.png`,
  })),
  ...SHRIMP_TEXTURES.attack.map((key, index) => ({
    key,
    path: `assets/guardians/pistol-shrimp/attack/attack-0${index + 1}.png`,
  })),
  ...SHRIMP_TEXTURES.projectile.map((key, index) => ({
    key,
    path: `assets/guardians/pistol-shrimp/projectile/projectile-0${index + 1}.png`,
  })),
];

export function preloadRecifeOneAssets(scene: Phaser.Scene): void {
  RECIFE_ONE_IMAGE_ASSETS.forEach(({ key, path }) => scene.load.image(key, path));
}

export function shrimpProjectileTextureForLevel(upgradeLevel: number): string {
  const level = Math.max(0, Math.min(Math.floor(upgradeLevel), SHRIMP_TEXTURES.projectile.length - 1));
  return SHRIMP_TEXTURES.projectile[level];
}

export function createShrimpAnimations(scene: Phaser.Scene): void {
  createAnimation(scene, "shrimp-idle", [
    SHRIMP_TEXTURES.idle[0],
    SHRIMP_TEXTURES.idle[1],
    SHRIMP_TEXTURES.idle[2],
    SHRIMP_TEXTURES.idle[1],
  ], 900, -1);
  createAnimation(scene, "shrimp-windup", [
    SHRIMP_TEXTURES.attack[0],
    SHRIMP_TEXTURES.attack[1],
  ], 180);
  createAnimation(scene, "shrimp-attack", [
    SHRIMP_TEXTURES.attack[1],
    SHRIMP_TEXTURES.attack[2],
  ], 180);
  createAnimation(scene, "shrimp-recovery", [
    SHRIMP_TEXTURES.attack[2],
    SHRIMP_TEXTURES.attack[1],
    SHRIMP_TEXTURES.idle[0],
  ], 540);
  createAnimation(scene, "shrimp-disabled", [
    SHRIMP_TEXTURES.idle[0],
    SHRIMP_TEXTURES.idle[1],
  ], 700, -1);
}

function createAnimation(
  scene: Phaser.Scene,
  key: string,
  textureKeys: readonly string[],
  duration: number,
  repeat = 0,
): void {
  if (scene.anims.exists(key)) return;
  scene.anims.create({
    key,
    frames: textureKeys.map((textureKey) => ({ key: textureKey })),
    duration,
    repeat,
  });
}
