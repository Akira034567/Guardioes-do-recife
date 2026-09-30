import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { HUD_LAYOUT } from "../hudLayout";

/**
 * PALCO LARGO (celular deitado).
 *
 * O jogo é desenhado em 1280x720 (16:9), e um telefone deitado é bem mais comprido: ~2,2:1. No modo
 * FIT isso deixava duas faixas pretas dos lados e o jogo num "segmento central" da tela. No celular
 * o Phaser roda em EXPAND: a altura continua 720 e a LARGURA cresce até a proporção da tela (ver
 * `STAGE_MAX_WIDTH`). O mundo — fase, rotas, plataformas, o hub — continua em 0..1280 e fica
 * CENTRADO; a sobra dos lados (`stageExtent`) mostra o fundo estendido, e o HUD ancora nas bordas
 * da tela de verdade, e não nas do mundo.
 *
 * No desktop (e nos testes automatizados) nada disso liga: é o FIT de sempre.
 */
export const WIDE_STAGE = HUD_LAYOUT.compact && isLongScreen();

/**
 * Só telas MAIS COMPRIDAS que 16:9 (telefones: ~2:1 a 2,4:1). Num tablet (4:3) o EXPAND cresceria
 * para cima, e não para os lados — lá o FIT de sempre, com faixa em cima e embaixo, é o certo.
 * `screen` é o aparelho, independente de como ele está virado agora.
 */
function isLongScreen(): boolean {
  if (typeof screen === "undefined") return false;
  const long = Math.max(screen.width, screen.height);
  const short = Math.min(screen.width, screen.height);
  return short > 0 && long / short > 1.8;
}

/** Até onde o fundo estendido vai (2,8:1): mais largo que qualquer telefone deitado. */
export const STAGE_MAX_WIDTH = 2016;

/** Quanto o palco passa do mundo de CADA lado, em pixels do jogo (0 no desktop). */
export function stageExtent(scene: Phaser.Scene): number {
  return Math.max(0, (scene.scale.gameSize.width - GAME_WIDTH) / 2);
}

/** Maior sobra possível de cada lado: o fundo estendido é desenhado uma vez só, já cobrindo tudo. */
export const MAX_STAGE_EXTENT = (STAGE_MAX_WIDTH - GAME_WIDTH) / 2;

/**
 * Centraliza o mundo na câmera: a sobra do palco (o fundo estendido) fica metade de cada lado.
 */
export function centerCameraOnWorld(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera = scene.cameras.main): void {
  const extent = stageExtent(scene);
  camera.setBounds(-extent, 0, GAME_WIDTH + extent * 2, GAME_HEIGHT);
  camera.setScroll(-extent, 0);
}

/**
 * O HUB NÃO ESTICA, APROXIMA. O cenário do hub tem placas com texto pintado: espelhado para os
 * lados, elas apareceriam ao contrário. Então a câmera aproxima até o mundo cobrir a largura do
 * palco, cortando uma faixa em cima e embaixo (onde o cenário não tem lugar nenhum). A camada HTML
 * dos lugares faz a mesma conta em `ui.css` (`.gr-hub__spots`).
 */
export function coverStageWithWorld(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera = scene.cameras.main): void {
  camera.setZoom(Math.max(1, scene.scale.gameSize.width / GAME_WIDTH));
  camera.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}

/** Chama `listener` sempre que o palco muda de largura; desliga sozinho quando a cena encerra. */
export function onStageResize(scene: Phaser.Scene, listener: () => void): void {
  if (!WIDE_STAGE) return;
  let width = scene.scale.gameSize.width;
  const handler = (): void => {
    if (scene.scale.gameSize.width === width) return;
    width = scene.scale.gameSize.width;
    listener();
  };
  scene.scale.on(Phaser.Scale.Events.RESIZE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, handler));
}

/**
 * Estende uma imagem de fundo para além das bordas dela com cópias ESPELHADAS (lados, em cima,
 * embaixo e cantos). Espelho emenda sem costura em qualquer arte, e a imagem original fica
 * exatamente onde estava: as plataformas e as rotas da fase continuam em cima do desenho certo.
 */
export function mirrorAround(scene: Phaser.Scene, image: Phaser.GameObjects.Image): Phaser.GameObjects.Image[] {
  if (!WIDE_STAGE) return [];
  const width = image.displayWidth;
  const height = image.displayHeight;
  const copies: Phaser.GameObjects.Image[] = [];
  for (const dx of [-1, 0, 1]) {
    for (const dy of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      const copy = scene.add
        .image(image.x + dx * width, image.y + dy * height, image.texture.key)
        .setOrigin(image.originX, image.originY)
        .setScale(image.scaleX, image.scaleY)
        .setFlip(dx !== 0, dy !== 0)
        .setDepth(image.depth);
      copies.push(copy);
    }
  }
  return copies;
}

/** Recuos da área segura (`env(safe-area-inset-*)`) em pixels CSS, lidos de uma sonda invisível. */
export function safeInsetsCss(): { top: number; right: number; bottom: number; left: number } {
  if (typeof document === "undefined") return { top: 0, right: 0, bottom: 0, left: 0 };
  let probe = document.getElementById("gr-safe-probe");
  if (!probe) {
    probe = document.createElement("div");
    probe.id = "gr-safe-probe";
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  const px = (value: string): number => Number.parseFloat(value) || 0;
  return { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) };
}

/**
 * Onde o HUD pode encostar, em coordenadas do jogo: as bordas do palco menos o recorte da tela
 * (o notch do iPhone come ~90 px do jogo de cada lado quando deitado).
 */
export function hudEdges(scene: Phaser.Scene): { left: number; right: number } {
  const extent = stageExtent(scene);
  const cssHeight = scene.scale.displaySize.height || GAME_HEIGHT;
  const toGame = GAME_HEIGHT / cssHeight;
  const insets = safeInsetsCss();
  return {
    left: -extent + insets.left * toGame,
    right: GAME_WIDTH + extent - insets.right * toGame,
  };
}
