import type Phaser from "phaser";

/**
 * Arte do Meu Recife: o fundo pintado e as peças de decoração.
 *
 * Nada disto entra no boot. O boot carrega só a forma base dos Guardiões (`recifeOneAssets.ts`), e
 * `tests/guardian-art.test.ts` afere esse tamanho — o Recife pede a própria arte quando a cena abre,
 * e só as peças que estão realmente plantadas.
 */

export const REEF_BACKDROP_KEY = "reef-backdrop";
export const REEF_BACKDROP_PATH = "assets/reef/backdrop.png";

/** A textura de uma decoração. O id do catálogo é o nome do arquivo. */
// Só funções de caminho moram aqui: o catálogo importa este módulo, então importar o catálogo de
// volta fecharia um ciclo e deixaria `DECORATIONS` indefinido na carga.
export function reefDecorationKey(definitionId: string): string {
  return `reef-${definitionId}`;
}

export function reefDecorationPath(definitionId: string): string {
  return `assets/reef/${definitionId}.png`;
}

/** Põe na fila o fundo e as peças pedidas; o que já está carregado não entra de novo. */
export function preloadReefArt(scene: Phaser.Scene, definitionIds: readonly string[]): void {
  if (!scene.textures.exists(REEF_BACKDROP_KEY)) scene.load.image(REEF_BACKDROP_KEY, REEF_BACKDROP_PATH);
  for (const id of new Set(definitionIds)) {
    const key = reefDecorationKey(id);
    if (!scene.textures.exists(key)) scene.load.image(key, reefDecorationPath(id));
  }
}
