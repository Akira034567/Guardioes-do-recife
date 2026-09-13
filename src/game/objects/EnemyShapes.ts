import type Phaser from "phaser";
import type { EnemyShapeKey } from "../types";

/**
 * Desenho vetorial de cada silhueta de inimigo. A definição escolhe a forma por `art.shape`
 * (`data/enemies.ts`), então acrescentar um inimigo é acrescentar dados, não um `case` novo.
 * Sprites, quando existirem, substituem tudo isto.
 */
export type EnemyShapeDrawer = (graphic: Phaser.GameObjects.Graphics, radius: number, color: number, accent: number) => void;

export const ENEMY_SHAPES: Record<EnemyShapeKey, EnemyShapeDrawer> = {
  fish: (graphic, radius) => {
    graphic.fillEllipse(0, 0, radius * 2.2, radius * 1.35);
    graphic.fillTriangle(-radius * 0.85, 0, -radius * 1.55, -radius * 0.65, -radius * 1.55, radius * 0.65);
  },
  minnow: (graphic, radius) => {
    graphic.fillEllipse(0, 0, radius * 2.2, radius * 1.2);
    graphic.fillTriangle(-radius * 0.8, 0, -radius * 1.5, -radius * 0.6, -radius * 1.5, radius * 0.6);
  },
  dart: (graphic, radius) => {
    graphic.fillTriangle(-radius, -radius * 0.65, radius * 1.25, 0, -radius, radius * 0.65);
  },
  needle: (graphic, radius, color, accent) => {
    graphic.fillTriangle(-radius * 1.6, -radius * 0.4, radius * 1.9, 0, -radius * 1.6, radius * 0.4);
    graphic.fillStyle(accent, 1);
    graphic.fillTriangle(-radius * 1.6, -radius * 0.7, -radius * 1.1, 0, -radius * 1.6, radius * 0.7);
    graphic.fillStyle(color, 1);
  },
  shell: (graphic, radius, _color, accent) => {
    graphic.fillCircle(0, 0, radius);
    graphic.lineStyle(4, accent, 1);
    graphic.strokeCircle(0, 0, radius * 0.72);
    graphic.lineBetween(-radius * 0.5, -radius * 0.5, radius * 0.5, radius * 0.5);
  },
  moray: (graphic, radius, color, accent) => {
    graphic.fillEllipse(0, 0, radius * 2.6, radius * 1.1);
    graphic.fillTriangle(-radius * 1.1, 0, -radius * 2, -radius * 0.7, -radius * 2, radius * 0.7);
    graphic.fillStyle(accent, 1);
    for (let index = -2; index <= 2; index += 1) {
      graphic.fillCircle(index * radius * 0.42, -radius * 0.45, radius * 0.14);
    }
    graphic.fillStyle(color, 1);
    graphic.fillTriangle(radius * 0.9, -radius * 0.35, radius * 1.45, -radius * 0.1, radius * 0.9, radius * 0.1);
  },
  shark: (graphic, radius, color, accent) => {
    // Corpo fuselado, cauda em V e a barbatana dorsal que denuncia o caçador.
    graphic.fillEllipse(0, 0, radius * 2.6, radius * 1.25);
    graphic.fillTriangle(-radius * 1.05, 0, -radius * 2.05, -radius * 0.85, -radius * 2.05, radius * 0.85);
    graphic.fillTriangle(-radius * 0.1, -radius * 0.5, radius * 0.35, -radius * 1.3, radius * 0.6, -radius * 0.45);
    graphic.fillStyle(accent, 1);
    graphic.fillTriangle(radius * 0.85, radius * 0.05, radius * 1.35, radius * 0.05, radius * 0.95, radius * 0.42);
    graphic.fillCircle(radius * 0.75, -radius * 0.32, radius * 0.16);
    graphic.fillStyle(color, 1);
  },
  boss: (graphic, radius, color, accent) => {
    graphic.fillCircle(0, 0, radius);
    graphic.fillStyle(accent, 1);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      graphic.fillCircle(Math.cos(angle) * radius * 0.78, Math.sin(angle) * radius * 0.78, 4);
    }
    graphic.fillStyle(color, 1);
  },
};
