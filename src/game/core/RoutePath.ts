import type { Vec2 } from "../types";

interface RouteSegment {
  start: Vec2;
  end: Vec2;
  length: number;
  startDistance: number;
  tangent: Vec2;
}

export interface ClosestRoutePoint {
  point: Vec2;
  distance: number;
  routeDistance: number;
  progress: number;
}

export class RoutePath {
  readonly points: readonly Vec2[];
  readonly totalLength: number;
  private readonly segments: RouteSegment[];

  constructor(points: readonly Vec2[]) {
    if (points.length < 2) {
      throw new Error("A route needs at least two waypoints.");
    }

    this.points = points.map((point) => ({ ...point }));
    let accumulated = 0;
    this.segments = [];

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;

      this.segments.push({
        start: { ...start },
        end: { ...end },
        length,
        startDistance: accumulated,
        tangent: { x: dx / length, y: dy / length },
      });
      accumulated += length;
    }

    if (this.segments.length === 0) {
      throw new Error("A route cannot contain only coincident waypoints.");
    }
    this.totalLength = accumulated;
  }

  getPointAtDistance(distance: number): Vec2 {
    const clamped = Math.max(0, Math.min(this.totalLength, distance));
    const segment = this.findSegment(clamped);
    const local = Math.min(1, Math.max(0, (clamped - segment.startDistance) / segment.length));
    return {
      x: segment.start.x + (segment.end.x - segment.start.x) * local,
      y: segment.start.y + (segment.end.y - segment.start.y) * local,
    };
  }

  getPointAtProgress(progress: number): Vec2 {
    return this.getPointAtDistance(this.totalLength * Math.max(0, Math.min(1, progress)));
  }

  getTangentAtDistance(distance: number): Vec2 {
    return { ...this.findSegment(Math.max(0, Math.min(this.totalLength, distance))).tangent };
  }

  getProgress(distance: number): number {
    return Math.max(0, Math.min(1, distance / this.totalLength));
  }

  getClosestPoint(point: Vec2): ClosestRoutePoint {
    let closest: ClosestRoutePoint | null = null;
    for (const segment of this.segments) {
      const dx = segment.end.x - segment.start.x;
      const dy = segment.end.y - segment.start.y;
      const lengthSquared = dx * dx + dy * dy;
      const projection = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared));
      const projected = {
        x: segment.start.x + dx * projection,
        y: segment.start.y + dy * projection,
      };
      const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
      if (!closest || distance < closest.distance) {
        const routeDistance = segment.startDistance + segment.length * projection;
        closest = {
          point: projected,
          distance,
          routeDistance,
          progress: this.getProgress(routeDistance),
        };
      }
    }
    return closest as ClosestRoutePoint;
  }

  private findSegment(distance: number): RouteSegment {
    return (
      this.segments.find(
        (segment) => distance <= segment.startDistance + segment.length,
      ) ?? this.segments[this.segments.length - 1]
    );
  }
}
