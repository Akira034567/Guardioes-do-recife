import type Phaser from "phaser";

/**
 * Fundos pintados de cada fase. A geometria de cada fase (rota, plataformas e
 * correntes) foi traçada sobre a imagem correspondente, então trocar o arquivo
 * exige rever o `levels/recife*.ts` da fase.
 *
 * A imagem é desenhada centralizada no campo de jogo (entre o HUD de cima e o de
 * baixo) com largura igual à do jogo; os mapas novos têm 1280×634, logo a
 * coordenada de jogo é `x` igual e `y = y_da_imagem + 21`.
 */
export const LEVEL_BACKGROUND_KEYS = {
  "recife-1": "recife-one-background",
  "recife-2": "recife-two-background",
  "recife-3": "recife-three-background",
  "recife-4": "recife-four-background",
  "recife-5": "recife-five-background",
  "recife-6": "recife-six-background",
} as const;

export const LEVEL_BACKGROUND_ASSETS: ReadonlyArray<{ key: string; path: string }> = [
  { key: LEVEL_BACKGROUND_KEYS["recife-1"], path: "assets/levels/recife-one/background.png" },
  { key: LEVEL_BACKGROUND_KEYS["recife-2"], path: "assets/levels/recife-two/background.png" },
  { key: LEVEL_BACKGROUND_KEYS["recife-3"], path: "assets/levels/recife-three/background.png" },
  { key: LEVEL_BACKGROUND_KEYS["recife-4"], path: "assets/levels/recife-four/background.png" },
  { key: LEVEL_BACKGROUND_KEYS["recife-5"], path: "assets/levels/recife-five/background.png" },
  { key: LEVEL_BACKGROUND_KEYS["recife-6"], path: "assets/levels/recife-six/background.png" },
];

/** Caminho do fundo pintado, para as telas em HTML (que usam `<img>`, não textura do Phaser). */
export function levelBackgroundPath(key: string | undefined): string | null {
  return LEVEL_BACKGROUND_ASSETS.find((candidate) => candidate.key === key)?.path ?? null;
}

/**
 * Enfileira o fundo de uma fase (~2 MB cada), se ainda não estiver na memória. É chamado
 * no `preload` da `GameScene`, para o menu abrir sem esperar os seis mapas.
 */
export function preloadLevelBackground(scene: Phaser.Scene, key: string | undefined): void {
  if (!key || scene.textures.exists(key)) return;
  const asset = LEVEL_BACKGROUND_ASSETS.find((candidate) => candidate.key === key);
  if (asset) scene.load.image(asset.key, asset.path);
}
