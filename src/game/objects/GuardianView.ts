import Phaser from "phaser";
import { artTextureFor, artVariant, GUARDIAN_ART, hasGuardianArt, type ArtKind } from "../assets/guardianArt";
import { DEPTH } from "../constants";
import { NEUTRAL_AURA, sameAura } from "../core/Auras";
import type { MatchGuardian } from "../core/match/MatchGuardian";
import type { TrapPhase } from "../core/TrapCore";
import type { GuardianState, ResolvedAura, Vec2 } from "../types";
import { guardianVisualState, textureFor, visualTimings, type GuardianVisualState, type VisualTimings } from "../core/GuardianVisualState";
import { GUARDIAN_VISUAL } from "../data/balance";
import { spriteTilt } from "../core/SpriteOrientation";

/**
 * Desenho de um Guardião. Todo estado de jogo vem do `MatchGuardian`; aqui ficam só os detalhes
 * visuais (sprite da variante, investida do Tubarão, fase enterrada do Peixe-Pedra, selo do ramo).
 */
export class GuardianView extends Phaser.GameObjects.Container {
  private readonly bodyGraphic: Phaser.GameObjects.Graphics;
  private readonly badgeGraphic: Phaser.GameObjects.Graphics;
  private readonly artSprite: Phaser.GameObjects.Image | null;
  private readonly artBaselineY = 34;
  /** Estado do MOTOR, para detectar as transições. */
  private engineState: GuardianState = "idle";
  /** Estado VISUAL, que é o que decide textura e tween. Ver `core/GuardianVisualState`. */
  private visualState: GuardianVisualState = "idle";
  /** Instante do golpe: a âncora de toda a janela de animação. `null` = nenhum golpe em curso. */
  private strikeAt: number | null = null;
  private abilityUntilMs = 0;
  private visualTimings: VisualTimings;
  /** Lado do sprite na investida, com a mesma zona morta usada nos inimigos. */
  private facingLeft = false;
  private dashTarget: Vec2 | null = null;
  private trapPhase: TrapPhase | null = null;
  private progressKey = "";
  private auraShown: ResolvedAura = NEUTRAL_AURA;

  constructor(
    scene: Phaser.Scene,
    readonly guardian: MatchGuardian,
    onSelect: () => void,
  ) {
    super(scene, guardian.x, guardian.y);
    this.bodyGraphic = scene.add.graphics();
    this.badgeGraphic = scene.add.graphics();
    this.add([this.bodyGraphic, this.badgeGraphic]);
    if (hasGuardianArt(scene, guardian.guardianId)) {
      // As imagens preservam a célula da tabela: a criatura fica encostada na base do canvas, então a
      // âncora é o centro da base e uma escala única por Guardião mantém a proporção entre variantes.
      this.artSprite = new Phaser.GameObjects.Image(scene, 0, this.artBaselineY, this.artTexture("idle"));
      this.artSprite.setOrigin(0.5, 1).setScale(GUARDIAN_ART[guardian.guardianId].scale);
      this.add(this.artSprite);
      this.bodyGraphic.setVisible(false);
    } else {
      this.artSprite = null;
    }
    this.trapPhase = guardian.trapPhase;
    this.visualTimings = visualTimings(guardian.definition, guardian.stats.cooldownMs);
    this.progressKey = this.currentProgressKey();
    this.drawBody();
    this.drawBadge();
    this.setDepth(DEPTH.guardians);
    this.setSize(80, 80);
    this.setInteractive(new Phaser.Geom.Circle(40, 40, 40), Phaser.Geom.Circle.Contains);
    this.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onSelect();
    });
    scene.add.existing(this);
    this.applyStateVisual();
    // Entrada curta: a unidade "assenta" no lugar em vez de aparecer do nada (item 32).
    this.setScale(0.72);
    scene.tweens.add({ targets: this, scale: 1, duration: 220, ease: "Back.Out" });
  }

  get id(): string {
    return this.guardian.id;
  }

  get usesSpriteArt(): boolean {
    return this.artSprite !== null;
  }

  get currentVisualKey(): string {
    return this.artSprite ? this.artTexture(this.artVisualState) : this.visualState;
  }

  get currentTextureKey(): string | null {
    return this.artSprite?.texture.key ?? null;
  }

  /** Pasta da variante visual atual (`base`, `perfuracao-1`, ...). */
  get artVariantFolder(): string {
    return artVariant(this.guardian.guardianId, this.guardian.progress).folder;
  }

  /** Chave de textura de um tipo de imagem para a variante visual atual. */
  artTexture(kind: ArtKind): string {
    return artTextureFor(this.guardian.guardianId, this.guardian.progress, kind);
  }

  /** Lê o estado do motor e atualiza o desenho. `enemyPosition` localiza o alvo da investida. */
  sync(now: number, enemyPosition: (id: string) => Vec2 | null): void {
    const guardian = this.guardian;
    const state = guardian.state;
    if (state !== this.engineState) {
      const previous = this.engineState;
      this.engineState = state;
      if (state === "windup") {
        // Estimativa: o golpe cai no fim do windup. O `attack` confirma logo em seguida.
        const snapshot = guardian.fsmSnapshot();
        this.strikeAt = snapshot.stateStartedAt + (snapshot.stateDurationMs ?? 0);
      } else if (state === "attack") {
        this.strikeAt = guardian.fsmSnapshot().stateStartedAt;
      } else if (previous === "windup" || state === "disabled") {
        // Golpe abortado (o alvo morreu antes do impacto): não pode chegar a mostrar ATAQUE.
        this.strikeAt = null;
      }
      if (state === "idle") this.dashTarget = null;
    }
    if (guardian.targetId) {
      const target = enemyPosition(guardian.targetId);
      if (target && Math.hypot(target.x - guardian.x, target.y - guardian.y) <= guardian.range) this.dashTarget = { x: target.x, y: target.y };
    }
    if (guardian.trapPhase !== this.trapPhase) {
      this.trapPhase = guardian.trapPhase;
      this.drawBody();
    }
    const progressKey = this.currentProgressKey();
    if (progressKey !== this.progressKey) {
      this.progressKey = progressKey;
      this.visualTimings = visualTimings(guardian.definition, guardian.stats.cooldownMs);
      this.drawBody();
      this.drawBadge();
      this.syncArtTexture();
    }

    // A janela de animação é curta e ancorada no golpe; fora dela o Guardião descansa, mesmo com
    // inimigo no alcance e mesmo com o cooldown ainda correndo. Era esse o item 15.
    const nextVisual = guardianVisualState({
      now,
      engineState: this.engineState,
      strikeAt: this.strikeAt,
      timings: this.visualTimings,
      abilityUntilMs: this.abilityUntilMs,
      returning: Boolean(guardian.stats.dash) && this.engineState === "recovery",
      trapPhase: this.trapPhase,
    });
    if (nextVisual !== this.visualState) {
      this.visualState = nextVisual;
      this.applyStateVisual();
    }
    if (!sameAura(this.auraShown, guardian.aura)) {
      this.auraShown = { ...guardian.aura };
      this.drawBadge();
    }
    this.animatePassiveVisual(now);
  }

  /** Pose de habilidade (pulso, sonar, coro, tinta). Chamada pelos efeitos, quando o evento sai. */
  playAbility(now: number, durationMs = GUARDIAN_VISUAL.abilityMs): void {
    this.abilityUntilMs = now + durationMs;
  }

  private currentProgressKey(): string {
    return `${this.guardian.branchId ?? "-"}:${this.guardian.upgradeLevel}`;
  }

  /**
   * Antecipação e impacto por deformação. Com arte real isto não existia — havia um `return` cedo
   * que deixava windup e recovery visualmente idênticos ao ataque.
   *
   * 🔶 números de apresentação, placeholders.
   */
  private stateSquash(): { x: number; y: number } {
    switch (this.visualState) {
      case "windup":
        return { x: 0.94, y: 1.07 };
      case "attack":
        return { x: 1.12, y: 0.92 };
      case "ability":
        return { x: 1.05, y: 1.05 };
      case "recovery":
      case "returning":
        return { x: 0.97, y: 1.02 };
      default:
        return { x: 1, y: 1 };
    }
  }

  private applyStateVisual(): void {
    if (this.visualState !== "idle") {
      this.bodyGraphic.y = 0;
      if (this.artSprite) this.artSprite.y = this.artBaselineY;
    }
    this.setAlpha(this.visualState === "disabled" ? 0.45 : 1);
    const squash = this.stateSquash();

    if (this.artSprite) {
      // A deformação vai no SPRITE, nunca no contêiner: a escala do contêiner é do tween de entrada.
      const base = GUARDIAN_ART[this.guardian.guardianId].scale;
      this.artSprite.setScale(base * squash.x, base * squash.y);
      this.setScale(1);
      this.syncArtTexture();
      return;
    }

    this.setScale(squash.x, squash.y);
  }

  private animatePassiveVisual(now: number): void {
    // O idle só flutua levemente: nunca alterna entre variantes/evoluções.
    const bob = Math.sin(now / 420 + this.x) * (this.visualState === "idle" ? 1.8 : 0.8);
    const dash = this.dashOffset(now);
    const buried = this.trapPhase === "arming" || this.trapPhase === "armed";
    const trapAlpha = this.trapPhase === "cooldown" ? 0.7 : this.trapPhase === "arming" ? 0.85 : 1;
    if (this.artSprite) {
      // O recuo do golpe acompanha o lado para o qual a criatura está virada.
      const mirror = this.facingLeft ? -1 : 1;
      const nudge = this.visualState === "attack" ? -4 : this.visualState === "recovery" || this.visualState === "returning" ? -2 : 0;
      this.artSprite.y = this.artBaselineY + bob + dash.y + (buried ? 6 : 0);
      this.artSprite.x = dash.x + nudge * mirror;
      this.artSprite.setFlipX(this.facingLeft);
      this.artSprite.setAngle(dash.angle ?? (this.visualState === "attack" ? -2 * mirror : 0));
      this.artSprite.setAlpha(trapAlpha);
    } else {
      this.bodyGraphic.x = dash.x;
      this.bodyGraphic.y = (this.visualState === "idle" ? bob : 0) + dash.y + (buried ? 4 : 0);
      this.bodyGraphic.setAngle(dash.angle ?? 0);
      this.bodyGraphic.setAlpha(trapAlpha);
    }
  }

  /**
   * Investida do Tubarão: sai da margem até perto do alvo durante o windup, morde no ataque e volta na
   * recuperação. Deslocamento em relação à própria posição; nunca sai do alcance.
   */
  private dashOffset(now: number): { x: number; y: number; angle: number | null } {
    const none = { x: 0, y: 0, angle: null };
    const stats = this.guardian.stats;
    if (!stats.dash || !this.dashTarget || this.engineState === "idle" || this.engineState === "disabled") return none;
    const dx = this.dashTarget.x - this.x;
    const dy = this.dashTarget.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return none;
    const reach = Math.max(0, Math.min(distance - 18, this.guardian.range));
    const snapshot = this.guardian.fsmSnapshot();
    const duration = snapshot.stateDurationMs ?? 1;
    const elapsed = Math.max(0, Math.min(1, (now - snapshot.stateStartedAt) / Math.max(1, duration)));
    const speed = Math.max(1, stats.dashSpeedMultiplier);
    const returning = this.engineState === "recovery";
    let fraction = 0;
    if (this.engineState === "windup") fraction = Math.min(1, elapsed * speed);
    else if (this.engineState === "attack") fraction = 1;
    else fraction = 1 - Math.min(1, elapsed * speed);
    const eased = fraction * fraction * (3 - 2 * fraction);

    // A cabeça aponta para onde ele NADA, não para onde está o alvo: na ida, o alvo; na volta, o
    // posto. Antes o ângulo era `atan2 * 0.25` sem normalizar, o que virava um alvo à esquerda
    // (180°) em 45° — o tubarão deitava para baixo-direita enquanto avançava para a esquerda.
    const travelX = returning ? -dx : dx;
    const travelY = returning ? -dy : dy;
    const heading = Math.atan2(travelY, travelX);
    if (Math.abs(Math.cos(heading)) >= 0.15) this.facingLeft = Math.cos(heading) < 0;
    const tilt = Phaser.Math.RadToDeg(this.facingLeft ? -spriteTilt(heading) : spriteTilt(heading));
    return {
      x: (dx / distance) * reach * eased,
      y: (dy / distance) * reach * eased,
      angle: eased > 0.05 ? tilt : null,
    };
  }

  /** Só existem duas texturas em disco por variante; o resto é tween. */
  private get artVisualState(): "idle" | "attack" {
    return textureFor(this.visualState);
  }

  /** Exposto para o HUD e as sondas de teste: qual pose está na tela agora. */
  get currentVisualState(): GuardianVisualState {
    return this.visualState;
  }

  private syncArtTexture(): void {
    if (!this.artSprite) return;
    const texture = this.artTexture(this.artVisualState);
    if (this.artSprite.texture.key !== texture && this.scene.textures.exists(texture)) this.artSprite.setTexture(texture);
  }

  /** Anel colorido do ramo escolhido + marcadores de nível; halo quando recebe aura. */
  private drawBadge(): void {
    this.badgeGraphic.clear();
    const buffed = !sameAura(this.guardian.aura, NEUTRAL_AURA);
    if (buffed) {
      this.badgeGraphic.lineStyle(2, 0xffc3f0, 0.55);
      this.badgeGraphic.strokeCircle(0, 6, 40);
    }
    const branch = this.guardian.branch;
    if (!branch) return;
    this.badgeGraphic.lineStyle(4, branch.color, 0.95);
    this.badgeGraphic.strokeCircle(0, 6, 34);
    this.badgeGraphic.fillStyle(branch.color, 1);
    for (let index = 0; index < this.guardian.upgradeLevel; index += 1) {
      this.badgeGraphic.fillCircle(-7 + index * 14, 44, 5);
      this.badgeGraphic.lineStyle(2, 0x03212f, 1);
      this.badgeGraphic.strokeCircle(-7 + index * 14, 44, 5);
    }
  }

  private drawBody(): void {
    const { definition, branchId, upgradeLevel } = this.guardian;
    const primary = definition.color;
    const accent = definition.accent;
    const graphic = this.bodyGraphic;
    graphic.clear();
    graphic.fillStyle(0x001823, 0.35);
    graphic.fillEllipse(0, 18, 62, 18);

    switch (definition.id) {
      case "pistol-shrimp":
        graphic.fillStyle(primary, 1);
        graphic.fillEllipse(-5, 0, 50, 30);
        graphic.fillCircle(-24, 1, 11);
        graphic.fillStyle(accent, 1);
        graphic.fillCircle(23, 5, 18);
        graphic.lineStyle(4, 0x062c3b, 1);
        graphic.lineBetween(23, -10, 23, 17);
        graphic.lineStyle(2, primary, 1);
        graphic.lineBetween(-18, -12, -30, -29);
        graphic.lineBetween(-10, -14, -15, -33);
        graphic.fillStyle(0xffffff, 1);
        graphic.fillCircle(-14, -7, 4);
        graphic.fillStyle(0x092333, 1);
        graphic.fillCircle(-13, -7, 2);
        break;
      case "jellyfish":
        graphic.fillStyle(primary, 0.95);
        graphic.fillEllipse(0, -3, 48, 38);
        graphic.fillRect(-24, -3, 48, 8);
        graphic.lineStyle(4, accent, 0.9);
        for (const x of [-16, -5, 6, 17]) graphic.lineBetween(x, 3, x - 4, 28);
        graphic.fillStyle(0xffffff, 1);
        graphic.fillCircle(-8, -8, 4);
        graphic.fillCircle(8, -8, 4);
        break;
      case "pufferfish":
        graphic.fillStyle(primary, 1);
        graphic.fillCircle(0, 0, 25);
        graphic.lineStyle(3, accent, 1);
        for (let index = 0; index < 12; index += 1) {
          const angle = (Math.PI * 2 * index) / 12;
          graphic.lineBetween(Math.cos(angle) * 22, Math.sin(angle) * 22, Math.cos(angle) * 32, Math.sin(angle) * 32);
        }
        graphic.fillStyle(0xffffff, 1);
        graphic.fillCircle(-8, -6, 5);
        graphic.fillCircle(8, -6, 5);
        graphic.fillStyle(0x092333, 1);
        graphic.fillCircle(-7, -6, 2);
        graphic.fillCircle(9, -6, 2);
        break;
      case "reef-crab":
        graphic.fillStyle(primary, 1);
        graphic.fillEllipse(0, 2, 46, 28);
        graphic.lineStyle(4, primary, 1);
        for (const side of [-1, 1]) {
          graphic.lineBetween(side * 14, 8, side * 28, 20);
          graphic.lineBetween(side * 20, 4, side * 34, 10);
          graphic.lineBetween(side * 18, -6, side * 30, -16);
        }
        graphic.fillStyle(accent, 1);
        graphic.fillCircle(-30, -20, 8);
        graphic.fillCircle(30, -20, 8);
        graphic.fillStyle(primary, 1);
        graphic.fillTriangle(-30, -28, -22, -20, -36, -18);
        graphic.fillTriangle(30, -28, 22, -20, 36, -18);
        graphic.fillStyle(0xffffff, 1);
        graphic.fillCircle(-9, -8, 4);
        graphic.fillCircle(9, -8, 4);
        graphic.fillStyle(0x092333, 1);
        graphic.fillCircle(-8, -8, 2);
        graphic.fillCircle(10, -8, 2);
        break;
      case "ink-octopus":
        graphic.fillStyle(primary, 1);
        graphic.fillEllipse(0, -6, 44, 40);
        graphic.lineStyle(5, primary, 1);
        for (const x of [-18, -9, 0, 9, 18]) {
          graphic.lineBetween(x, 10, x + (x < 0 ? -6 : 6), 30);
        }
        graphic.fillStyle(accent, 0.9);
        graphic.fillCircle(-12, -14, 4);
        graphic.fillCircle(6, -20, 3);
        graphic.fillCircle(14, -4, 3);
        graphic.fillStyle(0xffffff, 1);
        graphic.fillCircle(-8, -4, 5);
        graphic.fillCircle(8, -4, 5);
        graphic.fillStyle(0x092333, 1);
        graphic.fillCircle(-7, -4, 2.5);
        graphic.fillCircle(9, -4, 2.5);
        break;
      case "shark": {
        // Corpo fusiforme, barbatana dorsal, cauda em foice; o ramo Alfa fica mais pesado.
        const heavy = branchId === "b" ? 1 + upgradeLevel * 0.12 : 1;
        graphic.fillStyle(primary, 1);
        graphic.fillEllipse(0, 0, 66 * heavy, 24 * heavy);
        graphic.fillTriangle(-2, -12 * heavy, 12, -12 * heavy, 4, -30 * heavy);
        graphic.fillTriangle(-30 * heavy, 0, -46 * heavy, -16, -46 * heavy, 14);
        graphic.fillStyle(0xdbe8f0, 1);
        graphic.fillEllipse(6, 6, 50 * heavy, 10 * heavy);
        if (branchId === "a" && upgradeLevel > 0) {
          graphic.lineStyle(3, accent, 0.7);
          for (let index = 1; index <= upgradeLevel + 1; index += 1) graphic.lineBetween(-20 - index * 10, -6 + index * 3, -34 - index * 10, -6 + index * 3);
        }
        graphic.fillStyle(0xffffff, 1);
        graphic.fillCircle(20 * heavy, -5, 4);
        graphic.fillStyle(0x092333, 1);
        graphic.fillCircle(21 * heavy, -5, 2);
        graphic.lineStyle(2, 0x092333, 1);
        graphic.lineBetween(24 * heavy, 4, 32 * heavy, 2);
        break;
      }
      case "sea-turtle": {
        // Casco oval com placas; quatro nadadeiras; o ramo Casco engrossa, o Correnteza ganha faixas luminosas.
        const shell = branchId === "a" ? 1 + upgradeLevel * 0.15 : 1;
        graphic.fillStyle(primary, 1);
        for (const [sx, sy] of [
          [-20, -10],
          [20, -10],
          [-22, 12],
          [22, 12],
        ]) {
          graphic.fillEllipse(sx * shell, sy, 22, 10);
        }
        graphic.fillCircle(30 * shell, 0, 9);
        graphic.fillStyle(branchId === "a" ? 0x5b6b3a : 0x2f7a5a, 1);
        graphic.fillEllipse(0, 0, 50 * shell, 34 * shell);
        graphic.lineStyle(2, branchId === "b" && upgradeLevel > 0 ? 0x6fe3ff : accent, branchId === "b" ? 0.9 : 0.6);
        graphic.strokeEllipse(0, 0, 32 * shell, 20 * shell);
        graphic.lineBetween(-16 * shell, 0, 16 * shell, 0);
        graphic.lineBetween(0, -10 * shell, 0, 10 * shell);
        graphic.fillStyle(0xffffff, 1);
        graphic.fillCircle(33 * shell, -3, 2.5);
        graphic.fillStyle(0x092333, 1);
        graphic.fillCircle(34 * shell, -3, 1.3);
        break;
      }
      case "stonefish": {
        // Pedra irregular com espinhos; enterrado mostra só olhos e pontas.
        const buried = this.trapPhase === "arming" || this.trapPhase === "armed";
        graphic.fillStyle(primary, buried ? 0.55 : 1);
        graphic.fillEllipse(0, buried ? 8 : 2, 52, buried ? 14 : 30);
        graphic.lineStyle(3, accent, 1);
        for (let index = 0; index < 7; index += 1) {
          const angle = Math.PI + (Math.PI * index) / 6;
          const baseR = buried ? 10 : 14;
          graphic.lineBetween(Math.cos(angle) * baseR * 1.6, Math.sin(angle) * baseR + (buried ? 6 : 0), Math.cos(angle) * 30, Math.sin(angle) * 24 + (buried ? 6 : -4));
        }
        graphic.fillStyle(0xffffff, 1);
        graphic.fillCircle(-9, buried ? 2 : -6, 4);
        graphic.fillCircle(9, buried ? 2 : -6, 4);
        graphic.fillStyle(0x092333, 1);
        graphic.fillCircle(-8, buried ? 2 : -6, 2);
        graphic.fillCircle(10, buried ? 2 : -6, 2);
        break;
      }
      case "dolphin": {
        // Corpo curvo, barbatana dorsal, bico; Coro dourado, Sonar roxo.
        const tint = branchId === "a" && upgradeLevel > 0 ? 0xffd76a : branchId === "b" && upgradeLevel > 0 ? 0x9b7bff : accent;
        graphic.fillStyle(primary, 1);
        graphic.fillEllipse(0, 0, 60, 22);
        graphic.fillTriangle(-4, -10, 8, -10, 0, -24);
        graphic.fillTriangle(-26, 0, -40, -12, -40, 10);
        graphic.fillTriangle(26, -3, 40, 0, 26, 5);
        graphic.fillStyle(0xe6f7ff, 1);
        graphic.fillEllipse(4, 6, 42, 9);
        graphic.lineStyle(2, tint, 0.85);
        graphic.strokeCircle(0, -2, 34);
        if (upgradeLevel > 1) graphic.strokeCircle(0, -2, 42);
        graphic.fillStyle(0xffffff, 1);
        graphic.fillCircle(18, -5, 4);
        graphic.fillStyle(0x092333, 1);
        graphic.fillCircle(19, -5, 2);
        break;
      }
      default:
        graphic.fillStyle(primary, 1);
        graphic.fillEllipse(0, 0, 50, 30);
        graphic.fillStyle(accent, 1);
        graphic.fillCircle(12, -6, 5);
    }
  }
}
