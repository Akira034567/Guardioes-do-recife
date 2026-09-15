import type Phaser from "phaser";

/**
 * Arte do Peixinho Dourado.
 *
 * Sete peças fatiadas de uma prancha só (`art/golden/golden-sheet.png`, cortada por
 * `scripts/slice-golden-sheet.py`): três quadros de nado do peixinho, o rastro, o redemoinho, o pilar
 * e o clarão da coroação, e a coroa.
 *
 * Nada disto entra no boot — a fase pede a arte quando carrega, como o Recife faz com a decoração.
 *
 * Regra visual que vale para tudo aqui: DOURADO É SEMPRE PEIXINHO COROADO. O efeito do nó 5 da
 * maestria tem partícula própria, não-dourada, justamente para o jogador nunca confundir os dois.
 */

export const GOLDEN_FISH_FRAMES = ["golden-peixinho-1", "golden-peixinho-2", "golden-peixinho-3"] as const;
export const GOLDEN_CROWN_KEY = "golden-coroa";
export const GOLDEN_TRAIL_KEY = "golden-rastro";
export const GOLDEN_SWIRL_KEY = "golden-redemoinho";
export const GOLDEN_PILLAR_KEY = "golden-coroacao-pilar";
export const GOLDEN_FLASH_KEY = "golden-coroacao-flash";

const FILES: ReadonlyArray<readonly [key: string, file: string]> = [
  [GOLDEN_FISH_FRAMES[0], "peixinho-1"],
  [GOLDEN_FISH_FRAMES[1], "peixinho-2"],
  [GOLDEN_FISH_FRAMES[2], "peixinho-3"],
  [GOLDEN_CROWN_KEY, "coroa"],
  [GOLDEN_TRAIL_KEY, "rastro"],
  [GOLDEN_SWIRL_KEY, "redemoinho"],
  [GOLDEN_PILLAR_KEY, "coroacao-pilar"],
  [GOLDEN_FLASH_KEY, "coroacao-flash"],
];

/** Ritmo do nado do peixinho, quando ele aparece como recompensa. */
export const GOLDEN_FISH_FRAME_MS = 180;

/** Tamanho da coroa acima do Guardião, em pixels de jogo. */
export const GOLDEN_CROWN_WIDTH = 30;

/** Altura da coroa acima do centro do Guardião. */
export const GOLDEN_CROWN_OFFSET_Y = -34;

export function goldenAssetPath(file: string): string {
  return `assets/golden/${file}.png`;
}

/** Põe a arte do Peixinho na fila; o que já está carregado não entra de novo. */
export function preloadGoldenArt(scene: Phaser.Scene): void {
  for (const [key, file] of FILES) {
    if (!scene.textures.exists(key)) scene.load.image(key, goldenAssetPath(file));
  }
}

/** Todas as chaves, para os testes conferirem que nenhuma peça da prancha ficou sem uso. */
export const GOLDEN_ART_KEYS: readonly string[] = FILES.map(([key]) => key);
