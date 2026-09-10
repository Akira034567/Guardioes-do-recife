import Phaser from "phaser";
import { SHRIMP_TEXTURES } from "../assets/recifeOneAssets";
import { DEPTH } from "../constants";
import { selectLeadingTarget } from "../core/Combat";
import { GuardianStateMachine, type GuardianFsmEvent } from "../core/GuardianStateMachine";
import type { GuardianDefinition, GuardianState, GuardianUpgrade } from "../types";
import type { Enemy } from "./Enemy";

export interface GuardianPlacementContext {
  routePlacementId?: string;
  routeDistance?: number;
}

export class Guardian extends Phaser.GameObjects.Container {
  readonly fsm: GuardianStateMachine;
  readonly instanceId: string;
  readonly definition: GuardianDefinition;
  upgradeLevel = 0;
  readonly routePlacementId: string | null;
  readonly routeDistance: number | null;

  private readonly bodyGraphic: Phaser.GameObjects.Graphics;
  private readonly artSprite: Phaser.GameObjects.Sprite | null;
  private visualState: GuardianState = "idle";
  private readonly artBaselineY = 34;

  constructor(
    scene: Phaser.Scene,
    instanceId: string,
    definition: GuardianDefinition,
    x: number,
    y: number,
    placement: GuardianPlacementContext = {},
  ) {
    super(scene, x, y);
    this.instanceId = instanceId;
    this.definition = definition;
    this.routePlacementId = placement.routePlacementId ?? null;
    this.routeDistance = placement.routeDistance ?? null;
    this.fsm = new GuardianStateMachine({
      ...definition.timings,
      impactAtMs: definition.animation.impactAtMs,
    });
    this.bodyGraphic = scene.add.graphics();
    this.add(this.bodyGraphic);
    if (definition.id === "pistol-shrimp" && scene.textures.exists(SHRIMP_TEXTURES.idle[0])) {
      this.artSprite = new Phaser.GameObjects.Sprite(scene, 0, this.artBaselineY, SHRIMP_TEXTURES.idle[0]);
      this.artSprite.setOrigin(0.5, 1).setScale(0.88);
      this.add(this.artSprite);
      this.bodyGraphic.setVisible(false);
    } else {
      this.artSprite = null;
    }
    this.drawBody();
    this.setDepth(DEPTH.guardians);
    scene.add.existing(this);
    this.applyStateVisual();
  }

  get guardianState(): GuardianState {
    return this.fsm.state;
  }

  get targetId(): string | null {
    return this.fsm.targetId;
  }

  get usesSpriteArt(): boolean {
    return this.artSprite !== null;
  }

  get currentAnimationKey(): string {
    return this.artSprite?.anims.currentAnim?.key ?? this.definition.animation.states[this.visualState].key;
  }

  get currentTextureKey(): string | null {
    return this.artSprite?.texture.key ?? null;
  }

  get range(): number {
    return this.definition.range * this.productOf("rangeMultiplier");
  }

  get damage(): number {
    return this.definition.damage * this.productOf("damageMultiplier");
  }

  get extraTargets(): number {
    return this.appliedUpgrades.reduce((total, upgrade) => total + (upgrade.extraTargets ?? 0), 0);
  }

  get projectileSpeed(): number {
    return (this.definition.projectileSpeed ?? 400) * this.productOf("projectileSpeedMultiplier");
  }

  get predictiveAim(): boolean {
    return this.appliedUpgrades.some((upgrade) => upgrade.predictiveAim);
  }

  get secondaryDamageMultiplier(): number {
    return this.lastValue("secondaryDamageMultiplier") ?? 1;
  }

  get chainDamageMultiplier(): number {
    return this.lastValue("chainDamageMultiplier") ?? 1;
  }

  get blockCapacity(): number {
    if (this.definition.placementMode !== "route") return 0;
    return this.lastValue("blockCapacity") ?? 1;
  }

  get contactDamagePerSecond(): number {
    return this.lastValue("contactDamagePerSecond") ?? 0;
  }

  get electricField(): GuardianUpgrade["electricField"] | null {
    return [...this.appliedUpgrades].reverse().find((upgrade) => upgrade.electricField)?.electricField ?? null;
  }

  get nextUpgrade(): GuardianUpgrade | null {
    return this.definition.upgrades[this.upgradeLevel] ?? null;
  }

  get canUpgrade(): boolean {
    return this.upgradeLevel < this.definition.upgrades.length;
  }

  upgrade(): boolean {
    if (!this.canUpgrade) return false;
    this.upgradeLevel += 1;
    this.drawBody();
    return true;
  }

  tick(now: number, enemies: readonly Enemy[], onImpact: (guardian: Guardian, target: Enemy) => void): void {
    if (this.fsm.state === "idle") {
      const target = this.findTarget(enemies);
      if (target) this.processEvents(this.fsm.beginAttack(target.instanceId, now), enemies, onImpact);
    }

    const target = enemies.find((enemy) => enemy.instanceId === this.fsm.targetId);
    const valid = Boolean(target && !target.dead && !target.reachedGoal && target.distanceTo(this.x, this.y) <= this.range);
    this.processEvents(this.fsm.update(now, valid), enemies, onImpact);
    this.animatePassiveVisual(now);
  }

  private findTarget(enemies: readonly Enemy[]): Enemy | undefined {
    return selectLeadingTarget(enemies, this, this.range);
  }

  private processEvents(
    events: readonly GuardianFsmEvent[],
    enemies: readonly Enemy[],
    onImpact: (guardian: Guardian, target: Enemy) => void,
  ): void {
    for (const event of events) {
      if (event.type === "transition") {
        this.visualState = event.transition.current;
        this.applyStateVisual();
      } else {
        const target = enemies.find((enemy) => enemy.instanceId === event.targetId);
        if (target && !target.dead && !target.reachedGoal) onImpact(this, target);
      }
    }
  }

  private applyStateVisual(): void {
    if (this.visualState !== "idle") {
      this.bodyGraphic.y = 0;
      if (this.artSprite) this.artSprite.y = this.artBaselineY;
    }
    this.setAlpha(this.visualState === "disabled" ? 0.45 : 1);

    if (this.artSprite) {
      this.setScale(1);
      const animationKey = this.definition.animation.states[this.visualState].key;
      if (this.scene.anims.exists(animationKey)) this.artSprite.play(animationKey, true);
      return;
    }

    switch (this.visualState) {
      case "windup":
        this.setScale(0.94, 1.07);
        break;
      case "attack":
        this.setScale(1.12, 0.92);
        break;
      case "recovery":
        this.setScale(0.96, 1);
        break;
      case "disabled":
        this.setScale(1);
        break;
      case "idle":
        this.setScale(1);
        break;
    }
  }

  private animatePassiveVisual(now: number): void {
    if (this.visualState !== "idle") return;
    const bob = Math.sin(now / 420 + this.x) * 1.8;
    if (this.artSprite) this.artSprite.y = this.artBaselineY + bob;
    else this.bodyGraphic.y = bob;
  }

  private drawBody(): void {
    const primary = this.definition.color;
    const accent = this.definition.accent;
    this.bodyGraphic.clear();
    this.bodyGraphic.fillStyle(0x001823, 0.35);
    this.bodyGraphic.fillEllipse(0, 18, 62, 18);

    if (this.definition.id === "pistol-shrimp") {
      this.bodyGraphic.fillStyle(primary, 1);
      this.bodyGraphic.fillEllipse(-5, 0, 50, 30);
      this.bodyGraphic.fillCircle(-24, 1, 11);
      this.bodyGraphic.fillStyle(accent, 1);
      this.bodyGraphic.fillCircle(23, 5, 18);
      this.bodyGraphic.lineStyle(4, 0x062c3b, 1);
      this.bodyGraphic.lineBetween(23, -10, 23, 17);
      this.bodyGraphic.lineStyle(2, primary, 1);
      this.bodyGraphic.lineBetween(-18, -12, -30, -29);
      this.bodyGraphic.lineBetween(-10, -14, -15, -33);
      this.bodyGraphic.fillStyle(0xffffff, 1);
      this.bodyGraphic.fillCircle(-14, -7, 4);
      this.bodyGraphic.fillStyle(0x092333, 1);
      this.bodyGraphic.fillCircle(-13, -7, 2);
    } else if (this.definition.id === "jellyfish") {
      this.bodyGraphic.fillStyle(primary, 0.95);
      this.bodyGraphic.fillEllipse(0, -3, 48, 38);
      this.bodyGraphic.fillRect(-24, -3, 48, 8);
      this.bodyGraphic.lineStyle(4, accent, 0.9);
      for (const x of [-16, -5, 6, 17]) this.bodyGraphic.lineBetween(x, 3, x - 4, 28);
      this.bodyGraphic.fillStyle(0xffffff, 1);
      this.bodyGraphic.fillCircle(-8, -8, 4);
      this.bodyGraphic.fillCircle(8, -8, 4);
    } else {
      this.bodyGraphic.fillStyle(primary, 1);
      this.bodyGraphic.fillCircle(0, 0, 25);
      this.bodyGraphic.lineStyle(3, accent, 1);
      for (let index = 0; index < 12; index += 1) {
        const angle = (Math.PI * 2 * index) / 12;
        this.bodyGraphic.lineBetween(Math.cos(angle) * 22, Math.sin(angle) * 22, Math.cos(angle) * 32, Math.sin(angle) * 32);
      }
      this.bodyGraphic.fillStyle(0xffffff, 1);
      this.bodyGraphic.fillCircle(-8, -6, 5);
      this.bodyGraphic.fillCircle(8, -6, 5);
      this.bodyGraphic.fillStyle(0x092333, 1);
      this.bodyGraphic.fillCircle(-7, -6, 2);
      this.bodyGraphic.fillCircle(9, -6, 2);
    }

  }

  private get appliedUpgrades(): readonly GuardianUpgrade[] {
    return this.definition.upgrades.slice(0, this.upgradeLevel);
  }

  private productOf(key: "damageMultiplier" | "rangeMultiplier" | "projectileSpeedMultiplier"): number {
    return this.appliedUpgrades.reduce((product, upgrade) => product * (upgrade[key] ?? 1), 1);
  }

  private lastValue<K extends "secondaryDamageMultiplier" | "chainDamageMultiplier" | "blockCapacity" | "contactDamagePerSecond">(
    key: K,
  ): GuardianUpgrade[K] | undefined {
    return [...this.appliedUpgrades].reverse().find((upgrade) => upgrade[key] !== undefined)?.[key];
  }
}
