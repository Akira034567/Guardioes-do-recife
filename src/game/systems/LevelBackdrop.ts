import Phaser from "phaser";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { resolveLevelPaths } from "../core/WaveDefinitions";
import type { LevelDefinition } from "../types";

/** Gerador determinístico simples para espalhar detalhes sem depender de Math.random. */
export function seededRandom(seed: string): () => number {
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/** Mistura duas cores (0..1) para desenhar camadas opacas sem discos de alpha sobrepostos. */
export function mixColor(base: number, overlay: number, amount: number): number {
  const channel = (shift: number): number => {
    const from = (base >> shift) & 0xff;
    const to = (overlay >> shift) & 0xff;
    return Math.round(from + (to - from) * amount) & 0xff;
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * Fundo procedural para fases ainda sem arte pintada: água, canal ao longo da
 * rota, pedras nas plataformas e tinta das correntes. Quando a fase tiver
 * `backgroundKey` carregado, a imagem substitui este desenho.
 */
export function drawLevelBackdrop(scene: Phaser.Scene, level: LevelDefinition, extent = 0): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(DEPTH.background);
  const { theme } = level;
  const top = HUD_TOP;
  const height = GAME_HEIGHT - HUD_BOTTOM - HUD_TOP;
  const random = seededRandom(level.id);

  // `extent`: no palco largo do celular a água e as faixas passam das bordas do mundo.
  graphics.fillStyle(theme.water, 1);
  graphics.fillRect(-extent, 0, GAME_WIDTH + extent * 2, GAME_HEIGHT);
  for (let band = 0; band < 6; band += 1) {
    graphics.fillStyle(0xffffff, 0.025 + band * 0.008);
    graphics.fillRect(-extent, top + (height / 6) * band, GAME_WIDTH + extent * 2, height / 6);
  }

  // Algas e pedras de fundo.
  for (let index = 0; index < 26; index += 1) {
    const x = random() * GAME_WIDTH;
    const y = top + 20 + random() * (height - 40);
    const size = 10 + random() * 26;
    graphics.fillStyle(theme.rock, 0.35 + random() * 0.3);
    graphics.fillEllipse(x, y, size * 1.6, size);
  }

  // Canal da rota: areia larga, faixa clara e brilho central. As camadas são
  // opacas com cores pré-misturadas para que as juntas arredondadas não apareçam.
  // Nos Canais Profundos há várias rotas: cada camada é pintada em TODAS antes da seguinte, senão a
  // areia de um canal cobriria o brilho do outro onde eles se cruzam.
  const paths = resolveLevelPaths(level);
  const strokeRoute = (width: number, color: number): void => {
    for (const path of paths) {
      graphics.lineStyle(width, color, 1);
      graphics.beginPath();
      path.waypoints.forEach((point, index) => {
        if (index === 0) graphics.moveTo(point.x, point.y);
        else graphics.lineTo(point.x, point.y);
      });
      graphics.strokePath();
      graphics.fillStyle(color, 1);
      path.waypoints.forEach((point) => graphics.fillCircle(point.x, point.y, width / 2));
    }
  };
  const sandColor = mixColor(theme.water, theme.sand, 0.55);
  const pathColor = mixColor(sandColor, theme.path, 0.62);
  // Muro de pedra do canal: só nas fases de várias rotas, que é onde "canal" precisa ser lido.
  if (paths.length > 1) strokeRoute(140, mixColor(theme.water, theme.rock, 0.7));
  strokeRoute(118, sandColor);
  strokeRoute(88, pathColor);
  strokeRoute(30, mixColor(pathColor, 0xffffff, 0.16));

  // Redemoinhos: espiral pintada no leito (o giro animado é da cena, por cima).
  for (const whirlpool of level.whirlpools ?? []) {
    graphics.fillStyle(mixColor(pathColor, 0x0b2a44, 0.55), 1);
    graphics.fillCircle(whirlpool.x, whirlpool.y, whirlpool.radius * 0.9);
    for (let arm = 0; arm < 3; arm += 1) {
      graphics.lineStyle(3, 0xbff4ff, 0.35);
      graphics.beginPath();
      for (let step = 0; step <= 24; step += 1) {
        const t = step / 24;
        const angle = arm * ((Math.PI * 2) / 3) + t * Math.PI * 2.2;
        const radius = whirlpool.radius * 0.85 * (1 - t);
        const px = whirlpool.x + Math.cos(angle) * radius;
        const py = whirlpool.y + Math.sin(angle) * radius;
        if (step === 0) graphics.moveTo(px, py);
        else graphics.lineTo(px, py);
      }
      graphics.strokePath();
    }
  }

  // Comportas: o pilar de pedra onde a alavanca fica (a alavanca em si é da cena).
  for (const gate of level.gates ?? []) {
    graphics.fillStyle(0x000000, 0.25);
    graphics.fillEllipse(gate.x + 3, gate.y + 12, 60, 26);
    graphics.fillStyle(mixColor(theme.rock, 0x000000, 0.2), 1);
    graphics.fillRoundedRect(gate.x - 24, gate.y - 20, 48, 40, 10);
    graphics.lineStyle(2, 0xffd76a, 0.45);
    graphics.strokeRoundedRect(gate.x - 24, gate.y - 20, 48, 40, 10);
  }

  // Correntes: tinta translúcida e riscos no sentido do fluxo.
  level.currents.forEach((zone) => {
    graphics.fillStyle(0xffffff, 0.09);
    graphics.fillRoundedRect(zone.x, zone.y, zone.width, zone.height, 26);
    const length = Math.hypot(zone.direction.x, zone.direction.y) || 1;
    const dx = zone.direction.x / length;
    const dy = zone.direction.y / length;
    graphics.lineStyle(2, 0xffffff, 0.16);
    for (let index = 0; index < 10; index += 1) {
      const x = zone.x + 20 + random() * (zone.width - 40);
      const y = zone.y + 16 + random() * (zone.height - 32);
      graphics.lineBetween(x, y, x + dx * 34, y + dy * 34);
    }
  });

  // Plataformas: pedra escura com topo iluminado.
  level.placements.forEach((placement) => {
    graphics.fillStyle(0x000000, 0.22);
    graphics.fillEllipse(placement.x + 4, placement.y + 12, 104, 60);
    graphics.fillStyle(theme.rock, 1);
    graphics.fillEllipse(placement.x, placement.y + 6, 98, 58);
    graphics.fillStyle(theme.sand, 0.35);
    graphics.fillEllipse(placement.x - 4, placement.y - 2, 70, 34);
    graphics.lineStyle(2, 0xffffff, 0.2);
    graphics.strokeEllipse(placement.x, placement.y + 6, 98, 58);
  });

  // Bolhas.
  for (let index = 0; index < 18; index += 1) {
    graphics.lineStyle(1, 0xffffff, 0.25 + random() * 0.3);
    graphics.strokeCircle(random() * GAME_WIDTH, top + random() * height, 2 + random() * 5);
  }

  return graphics;
}
