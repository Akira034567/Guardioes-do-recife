import Phaser from "phaser";
import { enemyFrameKeys, hasEnemyArt } from "../assets/enemyArt";
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
  /** Sprite animado, quando a pasta de arte do inimigo existe; senão o desenho vetorial. */
  private readonly sprite: Phaser.GameObjects.Image | null;
  private readonly frameKeys: string[] = [];
  private readonly frameMs: number;
  private frameIndex = 0;
  private frameClockMs = 0;
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
    const art = enemy.definition.art;
    if (art.kind === "sprite" && hasEnemyArt(scene, enemy.definition)) {
      this.frameKeys = enemyFrameKeys(art);
      this.frameMs = art.frameMs ?? 160;
      this.sprite = new Phaser.GameObjects.Image(scene, 0, 0, this.frameKeys[0]);
      this.sprite.setScale((art.scale ?? 0.5) * enemy.definition.scale);
      // Os desenhos olham para a esquerda por padrão; o espelho põe o nariz em +x de uma vez por todas.
      this.sprite.setFlipX(art.facing !== "right");
      this.add(this.sprite);
    } else {
      this.sprite = null;
      this.frameMs = 160;
    }
    this.add([this.bodyGraphic, this.statusGraphic, this.healthBar]);
    if (this.sprite) this.bodyGraphic.setVisible(false);
    this.drawBody();
    this.setDepth(DEPTH.enemies + (enemy.definition.isBoss ? 2 : 0));
    scene.add.existing(this);
    this.sync(0);
  }

  get id(): string {
    return this.enemy.id;
  }

  sync(now: number, deltaMs = 0): void {
    const enemy = this.enemy;
    this.setPosition(enemy.x, enemy.y);
    if (this.sprite) this.animate(enemy.heading, deltaMs);
    else this.bodyGraphic.setRotation(enemy.heading);
    if (enemy.health !== this.lastHealth) {
      this.lastHealth = enemy.health;
      this.drawHealth();
    }
    this.refreshStatusVisual(now);
  }

  /** Troca de quadro no ritmo da arte e vira a criatura para o lado em que ela nada. */
  private animate(heading: number, deltaMs: number): void {
    const sprite = this.sprite;
    if (!sprite) return;
    const art = this.enemy.definition.art;
    const swimmingLeft = Math.cos(heading) < 0;
    if (art.kind === "sprite" && art.rotate === "upright") {
      // Bicho de leito: fica em pé e só olha para o lado em que anda.
      sprite.setRotation(0);
      sprite.setFlipY(false);
      sprite.setFlipX(art.facing === "right" ? swimmingLeft : !swimmingLeft);
    } else {
      // O nariz do desenho aponta para +x depois do espelho; daí a criatura gira junto com a rota e
      // vira de barriga para baixo quando nada para a esquerda (senão apareceria de cabeça para baixo).
      sprite.setRotation(heading);
      sprite.setFlipY(swimmingLeft);
    }
    if (this.frameKeys.length < 2) return;
    this.frameClockMs += deltaMs;
    if (this.frameClockMs < this.frameMs) return;
    this.frameClockMs = 0;
    this.frameIndex = (this.frameIndex + 1) % this.frameKeys.length;
    sprite.setTexture(this.frameKeys[this.frameIndex]);
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
    // Com sprite, a barra sobe até acima do desenho; sem ele, fica na borda do vetor como antes.
    const top = this.sprite ? -(this.sprite.displayHeight / 2 + 7) : -definition.hitRadius - 12;
    this.healthBar.clear();
    this.healthBar.fillStyle(0x061823, 0.9);
    this.healthBar.fillRoundedRect(-width / 2, top, width, 5, 2);
    this.healthBar.fillStyle(ratio > 0.45 ? 0x63e08b : 0xff6b6b, 1);
    this.healthBar.fillRoundedRect(-width / 2, top, width * ratio, 5, 2);
  }
}
