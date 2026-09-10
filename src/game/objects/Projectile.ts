import Phaser from "phaser";
import { DEPTH } from "../constants";
import { containsPoint, projectileDrift } from "../core/CurrentField";
import type { CurrentZoneDefinition } from "../types";
import type { Enemy } from "./Enemy";

export class Projectile extends Phaser.GameObjects.Arc {
  readonly radius = 6;
  readonly targetId: string;
  private readonly hitEnemyIds = new Set<string>();
  private remainingHits: number;
  private lifetimeMs = 0;
  private velocityX: number;
  private velocityY: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: Enemy,
    speed: number,
    readonly damage: number,
    extraTargets: number,
  ) {
    super(scene, x, y, 6, 0, 360, false, 0x5ae8ff, 1);
    this.targetId = target.instanceId;
    this.remainingHits = 1 + extraTargets;
    const angle = Math.atan2(target.y - y, target.x - x);
    this.velocityX = Math.cos(angle) * speed;
    this.velocityY = Math.sin(angle) * speed;
    this.setStrokeStyle(2, 0xd8fbff, 1);
    this.setDepth(DEPTH.projectiles);
    scene.add.existing(this);
  }

  tick(
    deltaMs: number,
    currents: readonly CurrentZoneDefinition[],
    currentReversed: boolean,
    enemies: readonly Enemy[],
  ): { hits: Enemy[]; expired: boolean } {
    const deltaSeconds = deltaMs / 1000;
    this.lifetimeMs += deltaMs;
    this.x += this.velocityX * deltaSeconds;
    this.y += this.velocityY * deltaSeconds;

    const zone = currents.find((candidate) => containsPoint(candidate, this));
    if (zone) {
      const drift = projectileDrift(zone, deltaSeconds, currentReversed);
      this.x += drift.x;
      this.y += drift.y;
    }

    const hits: Enemy[] = [];
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reachedGoal || this.hitEnemyIds.has(enemy.instanceId)) continue;
      if (Math.hypot(this.x - enemy.x, this.y - enemy.y) <= this.radius + enemy.definition.hitRadius) {
        this.hitEnemyIds.add(enemy.instanceId);
        hits.push(enemy);
        this.remainingHits -= 1;
        if (this.remainingHits <= 0) break;
      }
    }

    return {
      hits,
      expired:
        this.remainingHits <= 0 ||
        this.lifetimeMs >= 2200 ||
        this.x < -80 ||
        this.x > 1360 ||
        this.y < -80 ||
        this.y > 800,
    };
  }
}
