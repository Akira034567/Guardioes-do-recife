import Phaser from "phaser";
import { DEPTH } from "../constants";
import type { MatchEnemy } from "../core/match/MatchEnemy";
import { ELITES, type EliteId } from "../data/elites";
import { ENEMY_SHAPES } from "./EnemyShapes";

/**
 * Desenho de um inimigo. Nenhuma regra vive aqui: `sync()` lê o `MatchEnemy` do motor e redesenha
 * só o que mudou (vida, status). Substituído por sprites quando a arte dos inimigos for ligada.
 */
export class EnemyView extends Phaser.GameObjects.Container {
  private lastHealth = Number.NaN;
  private statusSignature = "";
  private readonly bodyGraphic: Phaser.GameObjects.Graphics;
  private readonly statusGraphic: Phaser.GameObjects.Graphics;
  private readonly healthBar: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    readonly enemy: MatchEnemy,
  ) {
    super(scene, enemy.x, enemy.y);
    this.bodyGraphic = scene.add.graphics();
    this.statusGraphic = scene.add.graphics();
    this.healthBar = scene.add.graphics();
    this.add([this.bodyGraphic, this.statusGraphic, this.healthBar]);
    this.drawBody();
    this.setDepth(DEPTH.enemies + (enemy.definition.isBoss ? 2 : 0));
    scene.add.existing(this);
    this.sync(0);
  }

  get id(): string {
    return this.enemy.id;
  }

  sync(now: number): void {
    const enemy = this.enemy;
    this.setPosition(enemy.x, enemy.y);
    this.bodyGraphic.setRotation(enemy.heading);
    if (enemy.health !== this.lastHealth) {
      this.lastHealth = enemy.health;
      this.drawHealth();
    }
    this.refreshStatusVisual(now);
  }

  private refreshStatusVisual(now: number): void {
    const status = this.enemy.status;
    const stunned = status.isStunned(now) || status.isHeld(now);
    const slowed = status.slowFactor(now) < 1;
    const vulnerable = status.damageMultiplier(now) > 1;
    const marked = status.isMarked(now);
    const priority = status.isPriority(now);
    const revealed = status.isRevealed(now);
    const poison = status.poisonStacks(now);
    const signature = `${stunned}-${slowed}-${vulnerable}-${marked}-${priority}-${revealed}-${poison}`;
    if (signature === this.statusSignature) return;
    this.statusSignature = signature;
    const radius = this.enemy.definition.hitRadius;
    const graphic = this.statusGraphic;
    graphic.clear();
    if (revealed) {
      graphic.lineStyle(1, 0x4fd6ff, 0.6);
      graphic.strokeCircle(0, 0, radius + 11);
    }
    if (slowed) {
      graphic.lineStyle(2, 0x7de6ff, 0.7);
      graphic.strokeCircle(0, 0, radius + 4);
    }
    if (vulnerable) {
      graphic.lineStyle(2, 0xd58cff, 0.85);
      graphic.strokeCircle(0, 0, radius + 8);
    }
    if (poison > 0) {
      graphic.fillStyle(0x8ef26b, 0.9);
      for (let index = 0; index < 2 + poison; index += 1) {
        const angle = -Math.PI / 2 + index * 0.7;
        graphic.fillCircle(Math.cos(angle) * (radius + 3), Math.sin(angle) * (radius + 3) - 2, 2.5);
      }
    }
    if (stunned) {
      graphic.fillStyle(0xfff27a, 0.95);
      for (let index = 0; index < 4; index += 1) {
        const angle = (Math.PI / 2) * index + Math.PI / 4;
        graphic.fillCircle(Math.cos(angle) * (radius + 6), Math.sin(angle) * (radius + 6), 3);
      }
    }
    if (marked) {
      // Marca do Tubarão Alfa: triângulo vermelho apontando para a presa.
      graphic.fillStyle(0xff4d5e, 0.95);
      graphic.fillTriangle(-7, -radius - 24, 7, -radius - 24, 0, -radius - 14);
      graphic.lineStyle(1, 0xfff0f0, 0.9);
      graphic.strokeTriangle(-7, -radius - 24, 7, -radius - 24, 0, -radius - 14);
    }
    if (priority) {
      // Ameaça prioritária do Sonar: losango roxo.
      graphic.lineStyle(2, 0x9b7bff, 0.95);
      const size = radius + 14;
      graphic.beginPath();
      graphic.moveTo(0, -size);
      graphic.lineTo(size, 0);
      graphic.lineTo(0, size);
      graphic.lineTo(-size, 0);
      graphic.closePath();
      graphic.strokePath();
    }
  }

  private drawBody(): void {
    const { definition } = this.enemy;
    const radius = definition.hitRadius;
    const { color, accent } = definition;
    this.bodyGraphic.clear();
    this.bodyGraphic.fillStyle(0x001925, 0.32);
    this.bodyGraphic.fillEllipse(-2, 4, radius * 2.5, radius * 1.45);
    this.bodyGraphic.fillStyle(color, 1);

    // A silhueta vem dos dados (`art.shape`); sprites, quando existirem, substituem o vetor.
    const shape = definition.art.kind === "procedural" ? definition.art.shape : (definition.art.shapeFallback ?? "fish");
    ENEMY_SHAPES[shape](this.bodyGraphic, radius, color, accent);

    this.bodyGraphic.fillStyle(accent, 1);
    this.bodyGraphic.fillCircle(radius * 0.45, -radius * 0.2, Math.max(2.5, radius * 0.16));
    this.bodyGraphic.fillStyle(0x082438, 1);
    this.bodyGraphic.fillCircle(radius * 0.49, -radius * 0.2, Math.max(1.4, radius * 0.08));

    // Elites ganham um anel com a cor do modificador para serem reconhecidos de longe.
    const elite = definition.eliteId ? ELITES[definition.eliteId as EliteId] : null;
    if (elite) {
      this.bodyGraphic.lineStyle(2, elite.tagColor, 0.95);
      this.bodyGraphic.strokeCircle(0, 0, radius + 5);
    }
  }

  private drawHealth(): void {
    const { definition } = this.enemy;
    const width = definition.isBoss ? 52 : definition.role === "elite" ? 40 : definition.role === "swarm" ? 18 : 30;
    const ratio = this.enemy.health / definition.maxHealth;
    this.healthBar.clear();
    this.healthBar.fillStyle(0x061823, 0.9);
    this.healthBar.fillRoundedRect(-width / 2, -definition.hitRadius - 12, width, 5, 2);
    this.healthBar.fillStyle(ratio > 0.45 ? 0x63e08b : 0xff6b6b, 1);
    this.healthBar.fillRoundedRect(-width / 2, -definition.hitRadius - 12, width * ratio, 5, 2);
  }
}
