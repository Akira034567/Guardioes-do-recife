import Phaser from "phaser";
import { DEPTH } from "../constants";
import { mitigatedDamage } from "../core/Combat";
import { containsPoint, enemySpeedMultiplier } from "../core/CurrentField";
import { EnemyStatus } from "../core/EnemyStatus";
import type { RoutePath } from "../core/RoutePath";
import type { CurrentZoneDefinition, EnemyDefinition, Vec2 } from "../types";

export interface EnemyTickResult {
  reachedGoal: boolean;
}

export interface DamageOptions {
  armorPiercing?: boolean;
}

export class Enemy extends Phaser.GameObjects.Container {
  readonly instanceId: string;
  readonly definition: EnemyDefinition;
  readonly status: EnemyStatus;
  health: number;
  pathDistance = 0;
  effectiveSpeed: number;
  dead = false;
  reachedGoal = false;
  blockedById: string | null = null;

  private now = 0;
  private statusSignature = "";
  private readonly bodyGraphic: Phaser.GameObjects.Graphics;
  private readonly statusGraphic: Phaser.GameObjects.Graphics;
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
    this.status = new EnemyStatus(definition.slowResistance ?? 0);
    this.health = definition.maxHealth;
    this.effectiveSpeed = definition.speed;
    this.bodyGraphic = scene.add.graphics();
    this.statusGraphic = scene.add.graphics();
    this.healthBar = scene.add.graphics();
    this.add([this.bodyGraphic, this.statusGraphic, this.healthBar]);
    this.drawBody();
    this.drawHealth();
    this.setDepth(DEPTH.enemies + (definition.isBoss ? 2 : 0));
    scene.add.existing(this);
  }

  get progress(): number {
    return this.route.getProgress(this.pathDistance);
  }

  get velocity(): Vec2 {
    if (this.blockedById) return { x: 0, y: 0 };
    const tangent = this.route.getTangentAtDistance(this.pathDistance);
    return { x: tangent.x * this.effectiveSpeed, y: tangent.y * this.effectiveSpeed };
  }

  get isBlockable(): boolean {
    return !this.definition.unblockable;
  }

  setBlocked(blockerId: string, stopDistance: number): void {
    this.blockedById = blockerId;
    this.pathDistance = Math.max(0, stopDistance);
    const point = this.route.getPointAtDistance(this.pathDistance);
    this.setPosition(point.x, point.y);
    this.effectiveSpeed = 0;
  }

  clearBlocked(): void {
    this.blockedById = null;
  }

  tick(
    now: number,
    deltaMs: number,
    currents: readonly CurrentZoneDefinition[],
    currentReversed: boolean,
  ): EnemyTickResult {
    if (this.dead || this.reachedGoal) return { reachedGoal: false };
    this.now = now;
    this.status.update(now);
    this.refreshStatusVisual();

    const tangent = this.route.getTangentAtDistance(this.pathDistance);
    if (this.blockedById) {
      this.effectiveSpeed = 0;
      const blockedPoint = this.route.getPointAtDistance(this.pathDistance);
      this.setPosition(blockedPoint.x, blockedPoint.y);
      this.bodyGraphic.setRotation(Math.atan2(tangent.y, tangent.x));
      return { reachedGoal: false };
    }
    const zone = currents.find((candidate) => containsPoint(candidate, this));
    const currentMultiplier = zone ? enemySpeedMultiplier(zone, tangent, currentReversed) : 1;
    this.effectiveSpeed = this.definition.speed * this.status.speedMultiplier(now) * currentMultiplier;
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

  /** Dano de golpe: sofre armadura (salvo perfuração) e vulnerabilidade. */
  takeDamage(rawDamage: number, options: DamageOptions = {}): boolean {
    if (this.dead || this.reachedGoal) return false;
    const base = options.armorPiercing ? Math.max(1, rawDamage) : mitigatedDamage(rawDamage, this.definition.armor);
    return this.applyHealthLoss(base * this.status.damageMultiplier(this.now));
  }

  /** Dano contínuo (contato, campos): ignora armadura, mas respeita vulnerabilidade. */
  takeContinuousDamage(amount: number): boolean {
    if (this.dead || this.reachedGoal) return false;
    return this.applyHealthLoss(Math.max(0, amount) * this.status.damageMultiplier(this.now));
  }

  applySlow(factor: number, durationMs: number, now: number): void {
    if (this.dead) return;
    this.status.applySlow(factor, durationMs, now);
  }

  tryStun(durationMs: number, immunityMs: number, now: number): boolean {
    if (this.dead) return false;
    return this.status.tryStun(durationMs, immunityMs, now);
  }

  tryHold(durationMs: number, immunityMs: number, now: number): boolean {
    if (this.dead) return false;
    return this.status.tryHold(durationMs, immunityMs, now);
  }

  applyVulnerability(multiplier: number, durationMs: number, now: number): void {
    if (this.dead) return;
    this.status.applyVulnerability(multiplier, durationMs, now);
  }

  distanceTo(x: number, y: number): number {
    return Math.hypot(this.x - x, this.y - y);
  }

  private applyHealthLoss(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    this.drawHealth();
    if (this.health <= 0) this.dead = true;
    return this.dead;
  }

  private refreshStatusVisual(): void {
    const stunned = this.status.isStunned(this.now) || this.status.isHeld(this.now);
    const slowed = this.status.slowFactor(this.now) < 1;
    const vulnerable = this.status.damageMultiplier(this.now) > 1;
    const signature = `${stunned}-${slowed}-${vulnerable}`;
    if (signature === this.statusSignature) return;
    this.statusSignature = signature;
    const radius = this.definition.hitRadius;
    this.statusGraphic.clear();
    if (slowed) {
      this.statusGraphic.lineStyle(2, 0x7de6ff, 0.7);
      this.statusGraphic.strokeCircle(0, 0, radius + 4);
    }
    if (vulnerable) {
      this.statusGraphic.lineStyle(2, 0xd58cff, 0.85);
      this.statusGraphic.strokeCircle(0, 0, radius + 8);
    }
    if (stunned) {
      this.statusGraphic.fillStyle(0xfff27a, 0.95);
      for (let index = 0; index < 4; index += 1) {
        const angle = (Math.PI / 2) * index + Math.PI / 4;
        this.statusGraphic.fillCircle(Math.cos(angle) * (radius + 6), Math.sin(angle) * (radius + 6), 3);
      }
    }
  }

  private drawBody(): void {
    const radius = this.definition.hitRadius;
    const { color, accent } = this.definition;
    this.bodyGraphic.clear();
    this.bodyGraphic.fillStyle(0x001925, 0.32);
    this.bodyGraphic.fillEllipse(-2, 4, radius * 2.5, radius * 1.45);
    this.bodyGraphic.fillStyle(color, 1);

    switch (this.definition.id) {
      case "minnow":
        this.bodyGraphic.fillEllipse(0, 0, radius * 2.2, radius * 1.2);
        this.bodyGraphic.fillTriangle(-radius * 0.8, 0, -radius * 1.5, -radius * 0.6, -radius * 1.5, radius * 0.6);
        break;
      case "dartfish":
        this.bodyGraphic.fillTriangle(-radius, -radius * 0.65, radius * 1.25, 0, -radius, radius * 0.65);
        break;
      case "needlefish":
        this.bodyGraphic.fillTriangle(-radius * 1.6, -radius * 0.4, radius * 1.9, 0, -radius * 1.6, radius * 0.4);
        this.bodyGraphic.fillStyle(accent, 1);
        this.bodyGraphic.fillTriangle(-radius * 1.6, -radius * 0.7, -radius * 1.1, 0, -radius * 1.6, radius * 0.7);
        break;
      case "shellback":
        this.bodyGraphic.fillCircle(0, 0, radius);
        this.bodyGraphic.lineStyle(4, accent, 1);
        this.bodyGraphic.strokeCircle(0, 0, radius * 0.72);
        this.bodyGraphic.lineBetween(-radius * 0.5, -radius * 0.5, radius * 0.5, radius * 0.5);
        break;
      case "moray":
        this.bodyGraphic.fillEllipse(0, 0, radius * 2.6, radius * 1.1);
        this.bodyGraphic.fillTriangle(-radius * 1.1, 0, -radius * 2, -radius * 0.7, -radius * 2, radius * 0.7);
        this.bodyGraphic.fillStyle(accent, 1);
        for (let index = -2; index <= 2; index += 1) {
          this.bodyGraphic.fillCircle(index * radius * 0.42, -radius * 0.45, radius * 0.14);
        }
        this.bodyGraphic.fillStyle(color, 1);
        this.bodyGraphic.fillTriangle(radius * 0.9, -radius * 0.35, radius * 1.45, -radius * 0.1, radius * 0.9, radius * 0.1);
        break;
      default:
        if (this.definition.isBoss) {
          this.bodyGraphic.fillCircle(0, 0, radius);
          this.bodyGraphic.fillStyle(accent, 1);
          for (let index = 0; index < 8; index += 1) {
            const angle = (Math.PI * 2 * index) / 8;
            this.bodyGraphic.fillCircle(Math.cos(angle) * radius * 0.78, Math.sin(angle) * radius * 0.78, 4);
          }
        } else {
          this.bodyGraphic.fillEllipse(0, 0, radius * 2.2, radius * 1.35);
          this.bodyGraphic.fillTriangle(-radius * 0.85, 0, -radius * 1.55, -radius * 0.65, -radius * 1.55, radius * 0.65);
        }
    }

    this.bodyGraphic.fillStyle(accent, 1);
    this.bodyGraphic.fillCircle(radius * 0.45, -radius * 0.2, Math.max(2.5, radius * 0.16));
    this.bodyGraphic.fillStyle(0x082438, 1);
    this.bodyGraphic.fillCircle(radius * 0.49, -radius * 0.2, Math.max(1.4, radius * 0.08));
  }

  private drawHealth(): void {
    const width = this.definition.isBoss ? 52 : this.definition.role === "elite" ? 40 : this.definition.role === "swarm" ? 18 : 30;
    const ratio = this.health / this.definition.maxHealth;
    this.healthBar.clear();
    this.healthBar.fillStyle(0x061823, 0.9);
    this.healthBar.fillRoundedRect(-width / 2, -this.definition.hitRadius - 12, width, 5, 2);
    this.healthBar.fillStyle(ratio > 0.45 ? 0x63e08b : 0xff6b6b, 1);
    this.healthBar.fillRoundedRect(-width / 2, -this.definition.hitRadius - 12, width * ratio, 5, 2);
  }
}
