import Phaser from "phaser";
import { shrimpProjectileTextureForLevel } from "../assets/recifeOneAssets";
import { DEPTH } from "../constants";
import { predictInterceptPoint, projectileTurnRate } from "../core/Combat";
import { containsPoint, projectileDrift } from "../core/CurrentField";
import type { CurrentZoneDefinition } from "../types";
import type { Enemy } from "./Enemy";

export class Projectile extends Phaser.GameObjects.Container {
  readonly radius = 6;
  targetId: string;
  readonly textureKey: string | null;
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
    private readonly speed: number,
    readonly damage: number,
    extraTargets: number,
    private readonly secondaryDamageMultiplier: number,
    private readonly predictiveAim: boolean,
    upgradeLevel: number,
  ) {
    super(scene, x, y);
    this.targetId = target.instanceId;
    this.remainingHits = 1 + extraTargets;
    const aimPoint = predictiveAim ? predictInterceptPoint({ x, y }, target, speed) : target;
    const angle = Math.atan2(aimPoint.y - y, aimPoint.x - x);
    this.velocityX = Math.cos(angle) * speed;
    this.velocityY = Math.sin(angle) * speed;

    const projectileKey = shrimpProjectileTextureForLevel(upgradeLevel);
    if (scene.textures.exists(projectileKey)) {
      const sprite = new Phaser.GameObjects.Image(scene, 0, 0, projectileKey);
      sprite.setScale(0.5);
      this.add(sprite);
      this.textureKey = projectileKey;
    } else {
      const fallback = new Phaser.GameObjects.Arc(scene, 0, 0, 6, 0, 360, false, 0x5ae8ff, 1);
      fallback.setStrokeStyle(2, 0xd8fbff, 1);
      this.add(fallback);
      this.textureKey = null;
    }

    this.setRotation(angle);
    this.setDepth(DEPTH.projectiles);
    scene.add.existing(this);
  }

  tick(
    deltaMs: number,
    currents: readonly CurrentZoneDefinition[],
    currentReversed: boolean,
    enemies: readonly Enemy[],
  ): { hits: Array<{ enemy: Enemy; damage: number }>; expired: boolean } {
    const deltaSeconds = deltaMs / 1000;
    this.lifetimeMs += deltaMs;

    const trackedTarget = enemies.find(
      (enemy) => enemy.instanceId === this.targetId && !enemy.dead && !enemy.reachedGoal,
    );
    if (trackedTarget) {
      const aimPoint = this.predictiveAim ? predictInterceptPoint(this, trackedTarget, this.speed) : trackedTarget;
      const currentAngle = Math.atan2(this.velocityY, this.velocityX);
      const desiredAngle = Math.atan2(aimPoint.y - this.y, aimPoint.x - this.x);
      const angleDifference = Phaser.Math.Angle.Wrap(desiredAngle - currentAngle);
      const maxTurn = projectileTurnRate(this.predictiveAim, this.hitEnemyIds.size) * deltaSeconds;
      const newAngle = currentAngle + Phaser.Math.Clamp(angleDifference, -maxTurn, maxTurn);
      this.velocityX = Math.cos(newAngle) * this.speed;
      this.velocityY = Math.sin(newAngle) * this.speed;
    }

    this.x += this.velocityX * deltaSeconds;
    this.y += this.velocityY * deltaSeconds;
    this.rotation = Math.atan2(this.velocityY, this.velocityX);

    const zone = currents.find((candidate) => containsPoint(candidate, this));
    if (zone) {
      const drift = projectileDrift(zone, deltaSeconds, currentReversed);
      this.x += drift.x;
      this.y += drift.y;
    }

    const hits: Array<{ enemy: Enemy; damage: number }> = [];
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reachedGoal || this.hitEnemyIds.has(enemy.instanceId)) continue;
      if (Math.hypot(this.x - enemy.x, this.y - enemy.y) <= this.radius + enemy.definition.hitRadius) {
        this.hitEnemyIds.add(enemy.instanceId);
        const hitIndex = this.hitEnemyIds.size - 1;
        hits.push({
          enemy,
          damage: this.damage * (hitIndex === 0 ? 1 : this.secondaryDamageMultiplier),
        });
        this.remainingHits -= 1;
        if (this.remainingHits <= 0) break;
        const nextTarget = enemies
          .filter(
            (candidate) =>
              !candidate.dead &&
              !candidate.reachedGoal &&
              !this.hitEnemyIds.has(candidate.instanceId),
          )
          .sort(
            (first, second) =>
              Math.hypot(first.x - this.x, first.y - this.y) -
              Math.hypot(second.x - this.x, second.y - this.y),
          )[0];
        if (nextTarget) this.targetId = nextTarget.instanceId;
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
