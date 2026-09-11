import type Phaser from "phaser";
import { GUARDIAN_ART_ASSETS } from "./guardianArt";

export const RECIFE_ONE_BACKGROUND_KEY = "recife-one-background";

/** Fundo pintado do Recife 1 mais toda a arte dos Guardiões (ver `guardianArt.ts`). */
export const RECIFE_ONE_IMAGE_ASSETS: ReadonlyArray<{ key: string; path: string }> = [
  { key: RECIFE_ONE_BACKGROUND_KEY, path: "assets/levels/recife-one/background.png" },
  ...GUARDIAN_ART_ASSETS,
];

export function preloadRecifeOneAssets(scene: Phaser.Scene): void {
  RECIFE_ONE_IMAGE_ASSETS.forEach(({ key, path }) => scene.load.image(key, path));
}
