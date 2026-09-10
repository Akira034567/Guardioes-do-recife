import Phaser from "phaser";
import { DEPTH } from "../constants";
import { mitigatedDamage } from "../core/Combat";
import { containsPoint, enemySpeedMultiplier } from "../core/CurrentField";
import type { RoutePath } from "../core/RoutePath";
import type { CurrentZoneDefinition, EnemyDefinition } from "../types";

export interface EnemyTickResult {
  reachedGoal: boolean;
}

export class Enemy extends Phaser.GameObjects.Container {
  readonly instanceId: string;
  readonly definition: EnemyDefinition;
  health: number;
  pathDistance = 0;
  effectiveSpeed: number;
  dead = false;
  reachedGoal = false;

  private slowFactor = 1;
  private slowUntil = 0;
  private readonly bodyGraphic: Phaser.GameObjects.Graphics;
  private readonly healthBar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    instanceId: string,
    definition: EnemyDefinition,
    private readonly route: RoutePath,
  ) {
    const start = route.getPointAtDistance(0);
    super(scene, start.x, start.y);
    this.instanceId = instanceId;
    this.definition = definition;
    this.health = definition.maxHealth;
    this.effectiveSpeed = definition.speed;
    this.bodyGraphic = scene.add.graphics();
    this.healthBar = scene.add.graphics();
    this.add([this.bodyGraphic, this.healthBar]);
    this.drawBody();
    this.drawHealth();
    this.setDepth(DEPTH.enemies);
    scene.add.existing(this);
  }

  get progress(): number {
    return this.route.getProgress(this.pathDistance);
  }

  tick(
    now: number,
    deltaMs: number,
    currents: readonly CurrentZoneDefinition[],
    currentReversed: boolean,
  ): EnemyTickResult {
    if (this.dead || this.reachedGoal) return { reachedGoal: false };
    if (now >= this.slowUntil) this.slowFactor = 1;

    const tangent = this.route.getTangentAtDistance(this.pathDistance);
    const zone = currents.find((candidate) => containsPoint(candidate, this));
    const currentMultiplier = zone ? enemySpeedMultiplier(zone, tangent, currentReversed) : 1;
    this.effectiveSpeed = this.definition.speed * this.slowFactor * currentMultiplier;
    this.pathDistance += this.effectiveSpeed * (deltaMs / 1000);

    const point = this.route.getPointAtDistance(this.pathDistance);
    this.setPosition(point.x, point.y);
    this.bodyGraphic.setRotation(Math.atan2(tangent.y, tangent.x));

    if (this.pathDistance >= this.route.totalLength) {
      this.reachedGoal = true;
      return { reachedGoal: true };
    }
    return { reachedGoal: false };
  }

  takeDamage(rawDamage: number): boolean {
    if (this.dead || this.reachedGoal) return false;
    const damage = mitigatedDamage(rawDamage, this.definition.armor);
    this.health = Math.max(0, this.health - damage);
    this.drawHealth();
    if (this.health <= 0) this.dead = true;
    return this.dead;
  }

  applySlow(factor: number, durationMs: number, now: number): void {
    if (this.dead) return;
    this.slowFactor = Math.min(this.slowFactor, Math.max(0.2, factor));
    this.slowUntil = Math.max(this.slowUntil, now + durationMs);
  }

  distanceTo(x: number, y: number): number {
    return Math.hypot(this.x - x, this.y - y);
  }

  private drawBody(): void {
    const radius = this.definition.hitRadius;
    this.bodyGraphic.clear();
    this.bodyGraphic.fillStyle(0x001925, 0.32);
    this.bodyGraphic.fillEllipse(-2, 4, radius * 2.5, radius * 1.45);
    this.bodyGraphic.fillStyle(this.definition.color, 1);

    if (this.definition.id === "dartfish") {
      this.bodyGraphic.fillTriangle(-radius, -radius * 0.65, radius * 1.25, 0, -radius, radius * 0.65);
    } else if (this.definition.id === "shellback") {
      this.bodyGraphic.fillCircle(0, 0, radius);
      this.bodyGraphic.lineStyle(4, this.definition.accent, 1);
      this.bodyGraphic.strokeCircle(0, 0, radius * 0.72);
      this.bodyGraphic.lineBetween(-radius * 0.5, -radius * 0.5, radius * 0.5, radius * 0.5);
    } else if (this.definition.isBoss) {
      this.bodyGraphic.fillCircle(0, 0, radius);
      this.bodyGraphic.fillStyle(this.definition.accent, 1);
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        this.bodyGraphic.fillCircle(Math.cos(angle) * radius * 0.78, Math.sin(angle) * radius * 0.78, 4);
      }
    } else {
      this.bodyGraphic.fillEllipse(0, 0, radius * 2.2, radius * 1.35);
      this.bodyGraphic.fillTriangle(-radius * 0.85, 0, -radius * 1.55, -radius * 0.65, -radius * 1.55, radius * 0.65);
    }

    this.bodyGraphic.fillStyle(this.definition.accent, 1);
    this.bodyGraphic.fillCircle(radius * 0.45, -radius * 0.2, Math.max(2.5, radius * 0.16));
    this.bodyGraphic.fillStyle(0x082438, 1);
    this.bodyGraphic.fillCircle(radius * 0.49, -radius * 0.2, Math.max(1.4, radius * 0.08));
  }

  private drawHealth(): void {
    const width = this.definition.isBoss ? 52 : 30;
    this.healthBar.clear();
    this.healthBar.fillStyle(0x061823, 0.9);
    this.healthBar.fillRoundedRect(-width / 2, -this.definition.hitRadius - 12, width, 5, 2);
    this.healthBar.fillStyle(this.health / this.definition.maxHealth > 0.45 ? 0x63e08b : 0xff6b6b, 1);
    this.healthBar.fillRoundedRect(-width / 2, -this.definition.hitRadius - 12, width * (this.health / this.definition.maxHealth), 5, 2);
  }
}
