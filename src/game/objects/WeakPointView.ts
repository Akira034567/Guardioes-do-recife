import Phaser from "phaser";
import { DEPTH } from "../constants";
import type { MatchWeakPoint } from "../core/match/MatchWeakPoint";

/**
 * Um ponto fraco preso ao chefe (item 11). Desenho vetorial: os corais estão pintados dentro da
 * arte da baleia e separá-los exigiria reeditar o PNG, então por ora eles são desenhados por cima.
 * A posição vem inteiramente do motor (`weakPointWorldPosition`), que usa a mesma transformação de
 * espelho e inclinação do sprite do chefe — por isso eles não descolam nas curvas.
 */
export class WeakPointView extends Phaser.GameObjects.Container {
  private readonly coral: Phaser.GameObjects.Graphics;
  private readonly healthBar: Phaser.GameObjects.Graphics;
  private lastHealth = Number.NaN;
  private pulse = 0;

  constructor(
    scene: Phaser.Scene,
    readonly weakPoint: MatchWeakPoint,
  ) {
    super(scene, weakPoint.x, weakPoint.y);
    this.coral = scene.add.graphics();
    this.healthBar = scene.add.graphics();
    this.add([this.coral, this.healthBar]);
    // Acima do chefe: o ponto fraco precisa ser visível e clicável por cima do corpo dele.
    this.setDepth(DEPTH.enemies + 3);
    this.drawBody();
    scene.add.existing(this);
    this.sync(0);
  }

  get id(): string {
    return this.weakPoint.id;
  }

  sync(deltaMs: number): void {
    this.setPosition(this.weakPoint.x, this.weakPoint.y);
    this.pulse += deltaMs;
    // Respiro lento: sinaliza que o coral está vivo sem competir com a animação do chefe.
    this.coral.setScale(1 + Math.sin(this.pulse / 520) * 0.06);
    if (this.weakPoint.health !== this.lastHealth) {
      const tookDamage = !Number.isNaN(this.lastHealth) && this.weakPoint.health < this.lastHealth;
      this.lastHealth = this.weakPoint.health;
      this.drawHealth();
      if (tookDamage) this.flash();
    }
  }

  /** Clarão curto ao levar dano; é o retorno de que atirar no coral está valendo a pena. */
  private flash(): void {
    this.coral.setAlpha(1);
    this.scene.tweens.killTweensOf(this.coral);
    this.scene.tweens.add({ targets: this.coral, alpha: 0.45, duration: 70, yoyo: true });
  }

  /** Ruptura: o coral estoura e some. */
  playBreak(onDone: () => void): void {
    this.healthBar.clear();
    this.scene.tweens.killTweensOf(this.coral);
    this.scene.tweens.add({
      targets: this,
      scale: 2.1,
      alpha: 0,
      angle: 140,
      duration: 260,
      ease: "Cubic.Out",
      onComplete: () => {
        onDone();
        this.destroy();
      },
    });
  }

  private drawBody(): void {
    const plan = this.weakPoint.parent.definition.weakPoints;
    const radius = this.weakPoint.definition.hitRadius;
    const color = plan?.color ?? 0xb44bd6;
    const accent = plan?.accent ?? 0xff8ae8;
    this.coral.clear();
    // Halo, para o coral se destacar do dorso escuro do chefe.
    this.coral.fillStyle(accent, 0.18);
    this.coral.fillCircle(0, 0, radius * 1.7);
    // Aglomerado: três ramos irregulares saindo de uma base.
    this.coral.fillStyle(color, 1);
    this.coral.fillCircle(0, radius * 0.35, radius * 0.72);
    for (const [angle, length] of [
      [-Math.PI / 2, 1.25],
      [-Math.PI / 2 - 0.75, 0.95],
      [-Math.PI / 2 + 0.8, 1.05],
    ] as const) {
      const tipX = Math.cos(angle) * radius * length;
      const tipY = Math.sin(angle) * radius * length + radius * 0.2;
      this.coral.lineStyle(Math.max(2, radius * 0.32), color, 1);
      this.coral.lineBetween(0, radius * 0.3, tipX, tipY);
      this.coral.fillStyle(accent, 1);
      this.coral.fillCircle(tipX, tipY, radius * 0.26);
    }
    this.coral.lineStyle(1.5, accent, 0.85);
    this.coral.strokeCircle(0, radius * 0.35, radius * 0.72);
  }

  private drawHealth(): void {
    const radius = this.weakPoint.definition.hitRadius;
    const ratio = Math.max(0, this.weakPoint.health / Math.max(1, this.weakPoint.definition.maxHealth));
    const width = radius * 2.4;
    const top = -radius * 1.9;
    this.healthBar.clear();
    if (ratio >= 1) return;
    this.healthBar.fillStyle(0x02131d, 0.8);
    this.healthBar.fillRect(-width / 2, top, width, 3);
    this.healthBar.fillStyle(0xff8ae8, 1);
    this.healthBar.fillRect(-width / 2, top, width * ratio, 3);
  }
}
