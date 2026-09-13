import Phaser from "phaser";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
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
export function drawLevelBackdrop(scene: Phaser.Scene, level: LevelDefinition): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(DEPTH.background);
  const { theme } = level;
  const top = HUD_TOP;
  const height = GAME_HEIGHT - HUD_BOTTOM - HUD_TOP;
  const random = seededRandom(level.id);

  graphics.fillStyle(theme.water, 1);
  graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  for (let band = 0; band < 6; band += 1) {
    graphics.fillStyle(0xffffff, 0.025 + band * 0.008);
    graphics.fillRect(0, top + (height / 6) * band, GAME_WIDTH, height / 6);
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
  const strokeRoute = (width: number, color: number): void => {
    graphics.lineStyle(width, color, 1);
    graphics.beginPath();
    level.waypoints.forEach((point, index) => {
      if (index === 0) graphics.moveTo(point.x, point.y);
      else graphics.lineTo(point.x, point.y);
    });
    graphics.strokePath();
    graphics.fillStyle(color, 1);
    level.waypoints.forEach((point) => graphics.fillCircle(point.x, point.y, width / 2));
  };
  const sandColor = mixColor(theme.water, theme.sand, 0.55);
  const pathColor = mixColor(sandColor, theme.path, 0.62);
  strokeRoute(118, sandColor);
  strokeRoute(88, pathColor);
  strokeRoute(30, mixColor(pathColor, 0xffffff, 0.16));

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
