import Phaser from "phaser";
import { DEPTH } from "../constants";
import { selectLeadingTarget } from "../core/Combat";
import { GuardianStateMachine, type GuardianFsmEvent } from "../core/GuardianStateMachine";
import type { GuardianDefinition, GuardianState } from "../types";
import type { Enemy } from "./Enemy";

export class Guardian extends Phaser.GameObjects.Container {
  readonly fsm: GuardianStateMachine;
  readonly instanceId: string;
  readonly definition: GuardianDefinition;
  upgraded = false;

  private readonly bodyGraphic: Phaser.GameObjects.Graphics;
  private visualState: GuardianState = "idle";

  constructor(scene: Phaser.Scene, instanceId: string, definition: GuardianDefinition, x: number, y: number) {
    super(scene, x, y);
    this.instanceId = instanceId;
    this.definition = definition;
    this.fsm = new GuardianStateMachine({
      ...definition.timings,
      impactAtMs: definition.animation.impactAtMs,
    });
    this.bodyGraphic = scene.add.graphics();
    this.add(this.bodyGraphic);
    this.drawBody();
    this.setDepth(DEPTH.guardians);
    scene.add.existing(this);
  }

  get guardianState(): GuardianState {
    return this.fsm.state;
  }

  get targetId(): string | null {
    return this.fsm.targetId;
  }

  get range(): number {
    return this.definition.range * (this.upgraded ? (this.definition.upgrade.rangeMultiplier ?? 1) : 1);
  }

  get damage(): number {
    return this.definition.damage * (this.upgraded ? (this.definition.upgrade.damageMultiplier ?? 1) : 1);
  }

  get extraTargets(): number {
    return this.upgraded ? (this.definition.upgrade.extraTargets ?? 0) : 0;
  }

  upgrade(): boolean {
    if (this.upgraded) return false;
    this.upgraded = true;
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
    this.animatePlaceholder(now);
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
    if (this.visualState !== "idle") this.bodyGraphic.y = 0;
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
        this.setAlpha(0.45);
        this.setScale(1);
        break;
      case "idle":
        this.setAlpha(1);
        this.setScale(1);
        break;
    }
  }

  private animatePlaceholder(now: number): void {
    if (this.visualState !== "idle") return;
    const bob = Math.sin(now / 420 + this.x) * 1.8;
    this.bodyGraphic.y = bob;
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

    if (this.upgraded) {
      this.bodyGraphic.lineStyle(3, 0xffdf72, 1);
      this.bodyGraphic.strokeCircle(0, 0, 36);
      this.bodyGraphic.fillStyle(0xffdf72, 1);
      this.bodyGraphic.fillCircle(0, -39, 4);
    }
  }
}
