import type Phaser from "phaser";
import { GUARDIAN_ART_ASSETS } from "./guardianArt";
import { LEVEL_BACKGROUND_ASSETS, LEVEL_BACKGROUND_KEYS } from "./levelBackgrounds";

export const RECIFE_ONE_BACKGROUND_KEY = LEVEL_BACKGROUND_KEYS["recife-1"];

/**
 * Fundo pintado do Recife 1 mais toda a arte dos Guardiões (ver `guardianArt.ts`).
 * Os fundos das demais fases ficam em `levelBackgrounds.ts`.
 */
export const RECIFE_ONE_IMAGE_ASSETS: ReadonlyArray<{ key: string; path: string }> = [
  ...LEVEL_BACKGROUND_ASSETS.filter(({ key }) => key === RECIFE_ONE_BACKGROUND_KEY),
  ...GUARDIAN_ART_ASSETS,
];

export function preloadRecifeOneAssets(scene: Phaser.Scene): void {
  RECIFE_ONE_IMAGE_ASSETS.forEach(({ key, path }) => scene.load.image(key, path));
}
