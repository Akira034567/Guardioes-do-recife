import type Phaser from "phaser";
import { ENEMIES, resolveEnemy } from "../data/enemies";
import type { EnemyArtRef, EnemyDefinition, EnemyId } from "../types";

/**
 * Arte dos inimigos (`public/assets/enemies/<pasta>/frame-N.png`). Cada pasta tem alguns quadros de
 * uma animação simples de nado; a `EnemyView` alterna entre eles. Enquanto uma pasta não existir, o
 * inimigo continua no desenho vetorial (`EnemyShapes.ts`) — nada quebra por falta de imagem.
 */
export function enemyFrameKey(folder: string, frame: number): string {
  return `enemy-${folder}-${frame}`;
}

export function enemyFramePath(folder: string, frame: number): string {
  return `assets/enemies/${folder}/frame-${frame}.png`;
}

/** Chaves de todos os quadros de um inimigo, na ordem da animação. */
export function enemyFrameKeys(art: EnemyArtRef): string[] {
  if (art.kind !== "sprite") return [];
  return Array.from({ length: art.frames }, (_, index) => enemyFrameKey(art.folder, index + 1));
}

export interface EnemyArtAsset {
  key: string;
  path: string;
  enemyId: EnemyId;
}

/** Uma entrada por inimigo × quadro, para carregar e para os testes conferirem o que existe em disco. */
export const ENEMY_ART_ASSETS: readonly EnemyArtAsset[] = (Object.keys(ENEMIES) as EnemyId[]).flatMap((enemyId) => {
  const art = resolveEnemy(ENEMIES[enemyId]).art;
  if (art.kind !== "sprite") return [];
  return Array.from({ length: art.frames }, (_, index) => ({
    key: enemyFrameKey(art.folder, index + 1),
    path: enemyFramePath(art.folder, index + 1),
    enemyId,
  }));
});

/** Carrega a arte dos inimigos que aparecem nestas ondas. */
export function preloadEnemyArt(scene: Phaser.Scene, enemyIds: readonly EnemyId[]): void {
  const wanted = new Set(enemyIds);
  for (const asset of ENEMY_ART_ASSETS) {
    if (!wanted.has(asset.enemyId) || scene.textures.exists(asset.key)) continue;
    scene.load.image(asset.key, asset.path);
  }
}

/** A arte está pronta quando todos os quadros carregaram; senão, o vetor continua valendo. */
export function hasEnemyArt(scene: Phaser.Scene, definition: EnemyDefinition): boolean {
  const art = resolveEnemy(definition).art;
  const keys = enemyFrameKeys(art);
  return keys.length > 0 && keys.every((key) => scene.textures.exists(key));
}

/** Caminho do primeiro quadro, para o bestiário (que usa `<img>`, não textura do Phaser). */
export function enemyPortraitPath(definition: EnemyDefinition): string | null {
  const art = resolveEnemy(definition).art;
  return art.kind === "sprite" ? enemyFramePath(art.folder, 1) : null;
}
