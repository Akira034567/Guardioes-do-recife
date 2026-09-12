import type { Vec2 } from "../types";

/** Formas 2D compartilhadas por correntes, áreas de posicionamento e formas de alcance. */
export type Shape2D =
  | { kind: "rect"; x: number; y: number; width: number; height: number }
  | { kind: "circle"; x: number; y: number; radius: number }
  | { kind: "polygon"; points: Vec2[] };

export function shapeContainsPoint(shape: Shape2D, point: Vec2): boolean {
  switch (shape.kind) {
    case "rect":
      return point.x >= shape.x && point.x <= shape.x + shape.width && point.y >= shape.y && point.y <= shape.y + shape.height;
    case "circle":
      return Math.hypot(point.x - shape.x, point.y - shape.y) <= shape.radius;
    case "polygon": {
      // Ray casting: número ímpar de cruzamentos = dentro.
      let inside = false;
      const { points } = shape;
      for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
        const a = points[index];
        const b = points[previous];
        const crosses = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (crosses) inside = !inside;
      }
      return inside;
    }
  }
}

export function shapeCenter(shape: Shape2D): Vec2 {
  switch (shape.kind) {
    case "rect":
      return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
    case "circle":
      return { x: shape.x, y: shape.y };
    case "polygon": {
      const total = shape.points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
      const count = Math.max(1, shape.points.length);
      return { x: total.x / count, y: total.y / count };
    }
  }
}

export function shapeBounds(shape: Shape2D): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (shape.kind) {
    case "rect":
      return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.width, maxY: shape.y + shape.height };
    case "circle":
      return { minX: shape.x - shape.radius, minY: shape.y - shape.radius, maxX: shape.x + shape.radius, maxY: shape.y + shape.radius };
    case "polygon": {
      const xs = shape.points.map((point) => point.x);
      const ys = shape.points.map((point) => point.y);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
  }
}

export function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y) || 1;
  const x = vector.x / length;
  const y = vector.y / length;
  return { x: Object.is(x, -0) ? 0 : x, y: Object.is(y, -0) ? 0 : y };
}
