import Phaser from "phaser";
import type { VectorLayer, VectorShape } from "../data/reef/decorations";

/**
 * As primitivas vetoriais do Recife. Cada função desenha UMA camada dentro de uma caixa de
 * `width × height` centrada em (0, 0), com a base no rodapé da caixa — assim coral, pedra e alga
 * ficam apoiados no fundo sem cada peça precisar saber onde é o chão.
 *
 * Isto existe para o Recife ter vida antes da arte pintada chegar. Quando os PNGs existirem, a
 * decoração troca `art` para `sprite` e nada aqui é chamado.
 */

export interface ShapeContext {
  graphics: Phaser.GameObjects.Graphics;
  width: number;
  height: number;
  /** Sorteio semeado pela instância: a mesma peça tem sempre a mesma silhueta. */
  random: () => number;
}

type ShapePainter = (context: ShapeContext, layer: VectorLayer) => void;

const TAU = Math.PI * 2;

/** Onde a camada começa a desenhar, já aplicando o deslocamento declarado. */
function origin(context: ShapeContext, layer: VectorLayer): { x: number; y: number; w: number; h: number } {
  const w = context.width * layer.size;
  const h = context.height * layer.size;
  return {
    x: (layer.dx ?? 0) * context.width * 0.5,
    // A base da caixa é o chão: y = 0 no rodapé, negativo para cima.
    y: (layer.dy ?? 0) * context.height * 0.5,
    w,
    h,
  };
}

const blob: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  const jitter = layer.jitter ?? 0;
  const points: Phaser.Types.Math.Vector2Like[] = [];
  const steps = 14;
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * TAU;
    const wobble = 1 + (context.random() - 0.5) * jitter;
    points.push({ x: x + Math.cos(angle) * (w / 2) * wobble, y: y - h / 2 + Math.sin(angle) * (h / 2) * wobble });
  }
  context.graphics.fillPoints(points, true, true);
};

/**
 * Meia elipse apoiada no chão. Usa `fillPoints` em vez de `slice` porque a fatia do Phaser é sempre
 * circular: com uma peça larga e baixa (um leito de areia), o raio viraria a altura e o que era um
 * montinho sairia como um morro atravessando a tela.
 */
const dome: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  const points: Phaser.Types.Math.Vector2Like[] = [];
  const steps = 20;
  for (let index = 0; index <= steps; index += 1) {
    const angle = Math.PI + (index / steps) * Math.PI;
    points.push({ x: x + Math.cos(angle) * (w / 2), y: y + Math.sin(angle) * h });
  }
  context.graphics.fillPoints(points, true, true);
};

const fan: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  const blades = layer.repeat ?? 7;
  for (let index = 0; index < blades; index += 1) {
    const spread = blades === 1 ? 0 : index / (blades - 1) - 0.5;
    const angle = spread * Math.PI * 0.8;
    const tipX = x + Math.sin(angle) * (w / 2);
    const tipY = y - h * (0.55 + Math.cos(angle) * 0.45);
    context.graphics.fillTriangle(x - w * 0.04, y, x + w * 0.04, y, tipX, tipY);
  }
  context.graphics.fillEllipse(x, y - h * 0.02, w * 0.2, h * 0.08);
};

/**
 * Coral ramificado: um tronco e galhos que sobem abrindo. Os galhos são cápsulas inclinadas para
 * cima — desenhá-los como triângulos apontando para o lado fazia o coral parecer um monte de setas.
 */
const branch: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  const arms = layer.repeat ?? 5;
  const trunk = Math.max(2, w * 0.12);

  const limb = (fromX: number, fromY: number, toX: number, toY: number, thickness: number): void => {
    const angle = Math.atan2(toY - fromY, toX - fromX) + Math.PI / 2;
    const offsetX = (Math.cos(angle) * thickness) / 2;
    const offsetY = (Math.sin(angle) * thickness) / 2;
    context.graphics.fillPoints(
      [
        { x: fromX + offsetX, y: fromY + offsetY },
        { x: toX + offsetX, y: toY + offsetY },
        { x: toX - offsetX, y: toY - offsetY },
        { x: fromX - offsetX, y: fromY - offsetY },
      ],
      true,
      true,
    );
    context.graphics.fillCircle(toX, toY, thickness / 2);
  };

  limb(x, y, x, y - h * 0.62, trunk);
  for (let index = 0; index < arms; index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const along = 0.22 + (index / Math.max(1, arms - 1)) * 0.55;
    const baseY = y - h * along;
    const reach = w * 0.4 * (1 - along * 0.35);
    // O galho sempre termina mais alto do que começa: coral cresce em direção à luz.
    limb(x, baseY, x + side * reach, baseY - h * 0.26, trunk * 0.72);
  }
};

const ribbon: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  const blades = layer.repeat ?? 4;
  for (let index = 0; index < blades; index += 1) {
    const offset = blades === 1 ? 0 : (index / (blades - 1) - 0.5) * w;
    const lean = (context.random() - 0.5) * w * 0.35;
    const thickness = Math.max(1.5, w * 0.09);
    const points: Phaser.Types.Math.Vector2Like[] = [];
    const steps = 6;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const curve = Math.sin(t * Math.PI * 0.9) * lean;
      points.push({ x: x + offset + curve - thickness / 2, y: y - h * t });
    }
    for (let step = steps; step >= 0; step -= 1) {
      const t = step / steps;
      const curve = Math.sin(t * Math.PI * 0.9) * lean;
      const taper = thickness * (1 - t * 0.6);
      points.push({ x: x + offset + curve + taper / 2, y: y - h * t });
    }
    context.graphics.fillPoints(points, true, true);
  }
};

const column: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  context.graphics.fillRect(x - w * 0.18, y - h, w * 0.36, h);
  context.graphics.fillRect(x - w * 0.3, y - h * 0.08, w * 0.6, h * 0.08);
  context.graphics.fillRect(x - w * 0.28, y - h, w * 0.56, h * 0.07);
};

const spiral: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  const center = { x, y: y - h / 2 };
  const points: Phaser.Types.Math.Vector2Like[] = [{ x: center.x, y: center.y }];
  const turns = 2.6;
  const steps = 40;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const angle = t * TAU * turns;
    const radius = (w / 2) * t;
    points.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius * (h / w) });
  }
  context.graphics.fillPoints(points, true, true);
};

const arc: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  const outer: Phaser.Types.Math.Vector2Like[] = [];
  const steps = 18;
  for (let index = 0; index <= steps; index += 1) {
    const angle = Math.PI + (index / steps) * Math.PI;
    outer.push({ x: x + Math.cos(angle) * (w / 2), y: y + Math.sin(angle) * h });
  }
  for (let index = steps; index >= 0; index -= 1) {
    const angle = Math.PI + (index / steps) * Math.PI;
    outer.push({ x: x + Math.cos(angle) * (w / 2) * 0.6, y: y + Math.sin(angle) * h * 0.62 });
  }
  context.graphics.fillPoints(outer, true, true);
};

const star: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  const arms = layer.repeat ?? 5;
  const center = { x, y: y - h / 2 };
  const points: Phaser.Types.Math.Vector2Like[] = [];
  for (let index = 0; index < arms * 2; index += 1) {
    const angle = (index / (arms * 2)) * TAU - Math.PI / 2;
    const radius = index % 2 === 0 ? w / 2 : w / 5;
    points.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius * (h / w) });
  }
  context.graphics.fillPoints(points, true, true);
};

const orb: ShapePainter = (context, layer) => {
  const { x, y, w, h } = origin(context, layer);
  const count = layer.repeat ?? 1;
  for (let index = 0; index < count; index += 1) {
    const spread = count === 1 ? 0 : (index / (count - 1) - 0.5) * context.width * 0.7;
    const lift = count === 1 ? h / 2 : h * (0.3 + context.random() * 0.6);
    context.graphics.fillCircle(x + spread, y - lift, Math.max(1.5, w / 2));
  }
};

export const SHAPES: Record<VectorShape, ShapePainter> = {
  blob,
  dome,
  fan,
  branch,
  ribbon,
  column,
  spiral,
  arc,
  star,
  orb,
};

/** Desenha uma camada inteira: cor, transparência e a forma em si. */
export function paintLayer(context: ShapeContext, layer: VectorLayer): void {
  context.graphics.fillStyle(layer.color, layer.alpha ?? 1);
  if (layer.rotation) {
    // Girar uma camada isolada custaria um container por camada; a inclinação da peça inteira já
    // vem da instância, então aqui a rotação declarada vira um leve deslocamento lateral.
    context.graphics.translateCanvas(Math.sin((layer.rotation * Math.PI) / 180) * context.width * 0.1, 0);
  }
  SHAPES[layer.shape](context, layer);
  if (layer.rotation) {
    context.graphics.translateCanvas(-Math.sin((layer.rotation * Math.PI) / 180) * context.width * 0.1, 0);
  }
}
