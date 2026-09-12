import type Phaser from "phaser";
import { GUARDIAN_BASE_ART_ASSETS } from "./guardianArt";
import { LEVEL_BACKGROUND_ASSETS, LEVEL_BACKGROUND_KEYS } from "./levelBackgrounds";

export const RECIFE_ONE_BACKGROUND_KEY = LEVEL_BACKGROUND_KEYS["recife-1"];

/**
 * O que o jogo carrega antes do menu: o fundo pintado do Recife 1 e a forma base dos Guardiões.
 * As formas evoluídas entram na `GameScene`, só para o esquadrão da partida (item 45); os fundos
 * das demais fases ficam em `levelBackgrounds.ts`.
 */
export const RECIFE_ONE_IMAGE_ASSETS: ReadonlyArray<{ key: string; path: string }> = [
  ...LEVEL_BACKGROUND_ASSETS.filter(({ key }) => key === RECIFE_ONE_BACKGROUND_KEY),
  ...GUARDIAN_BASE_ART_ASSETS,
];

export function preloadRecifeOneAssets(scene: Phaser.Scene): void {
  RECIFE_ONE_IMAGE_ASSETS.forEach(({ key, path }) => scene.load.image(key, path));
}
