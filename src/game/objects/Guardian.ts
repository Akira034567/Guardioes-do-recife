import Phaser from "phaser";
import { artTextureFor, artVariant, GUARDIAN_ART, hasGuardianArt, type ArtKind } from "../assets/guardianArt";
import { DEPTH } from "../constants";
import { NEUTRAL_AURA, sameAura } from "../core/Auras";
import { targetPolicyFor } from "../core/GuardianBehaviors";
import { GuardianRuntime } from "../core/GuardianRuntime";
import { GuardianStateMachine, type GuardianFsmEvent } from "../core/GuardianStateMachine";
import { resolveGuardianStats, scaledTimings, type GuardianStats } from "../core/GuardianStats";
import { selectTarget } from "../core/Targeting";
import type { TrapPhase } from "../core/TrapCore";
import {
  appliedUpgrades,
  applyUpgrade,
  branchOf,
  branchStatuses,
  investedValue,
  MAX_UPGRADE_LEVEL,
  sellValue,
  upgradeOptions,
  type UpgradeProgress,
} from "../core/UpgradeTree";
import type {
  BranchId,
  BranchStatus,
  GuardianDefinition,
  GuardianId,
  GuardianState,
  GuardianUpgrade,
  ResolvedAura,
  UpgradeBranch,
  UpgradeOption,
  Vec2,
} from "../types";
import type { Enemy } from "./Enemy";

export interface GuardianPlacementContext {
  routePlacementId?: string;
  routeDistance?: number;
}

export class Guardian extends Phaser.GameObjects.Container {
  readonly fsm: GuardianStateMachine;
  readonly instanceId: string;
  readonly definition: GuardianDefinition;
  readonly routePlacementId: string | null;
  readonly routeDistance: number | null;
  readonly runtime = new GuardianRuntime();
  branchId: BranchId | null = null;
  upgradeLevel = 0;
  /** Contador de golpes para habilidades "a cada N ataques" (giro do Caranguejo). */
  attacksPerformed = 0;
  aura: ResolvedAura = NEUTRAL_AURA;

  private readonly bodyGraphic: Phaser.GameObjects.Graphics;
  private readonly badgeGraphic: Phaser.GameObjects.Graphics;
  private readonly artSprite: Phaser.GameObjects.Image | null;
  private visualState: GuardianState = "idle";
  private readonly artBaselineY = 34;
  private cachedStats: GuardianStats | null = null;
  /** Posição do alvo da investida (Tubarão), atualizada enquanto o alvo é válido. */
  private dashTarget: Vec2 | null = null;
  private trapPhase: TrapPhase | null = null;

  constructor(
    scene: Phaser.Scene,
    instanceId: string,
    definition: GuardianDefinition,
    x: number,
    y: number,
    placement: GuardianPlacementContext = {},
    now = 0,
  ) {
    super(scene, x, y);
    this.instanceId = instanceId;
    this.definition = definition;
    this.routePlacementId = placement.routePlacementId ?? null;
    this.routeDistance = placement.routeDistance ?? null;
    this.fsm = new GuardianStateMachine(scaledTimings(definition, this.stats.cooldownMs));
    this.runtime.syncStats(this.stats, now);
    if (this.stats.trap) this.trapPhase = "arming";
    this.bodyGraphic = scene.add.graphics();
    this.badgeGraphic = scene.add.graphics();
    this.add([this.bodyGraphic, this.badgeGraphic]);
    if (hasGuardianArt(scene, definition.id)) {
      // As imagens preservam a célula da tabela: a criatura fica encostada na base do canvas, então a
      // âncora é o centro da base e uma escala única por Guardião mantém a proporção entre variantes.
      this.artSprite = new Phaser.GameObjects.Image(scene, 0, this.artBaselineY, this.artTexture("idle"));
      this.artSprite.setOrigin(0.5, 1).setScale(GUARDIAN_ART[definition.id].scale);
      this.add(this.artSprite);
      this.bodyGraphic.setVisible(false);
    } else {
      this.artSprite = null;
    }
    this.drawBody();
    this.drawBadge();
    this.setDepth(DEPTH.guardians);
    scene.add.existing(this);
    this.applyStateVisual();
  }

  // ---------------------------------------------------------------- estado

  /** Mesmo nome usado pela simulação e pelos comportamentos compartilhados. */
  get id(): string {
    return this.instanceId;
  }

  get guardianId(): GuardianId {
    return this.definition.id;
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

  get currentVisualKey(): string {
    return this.artSprite ? this.artTexture(this.artVisualState) : this.visualState;
  }

  get currentTextureKey(): string | null {
    return this.artSprite?.texture.key ?? null;
  }

  /** Pasta da variante visual atual (`base`, `perfuracao-1`, ...). */
  get artVariantFolder(): string {
    return artVariant(this.definition.id, this.progress).folder;
  }

  /** Chave de textura de um tipo de imagem para a variante visual atual. */
  artTexture(kind: ArtKind): string {
    return artTextureFor(this.definition.id, this.progress, kind);
  }

  get currentTrapPhase(): TrapPhase | null {
    return this.trapPhase;
  }

  // -------------------------------------------------------------- upgrades

  get progress(): UpgradeProgress {
    return { branchId: this.branchId, upgradeLevel: this.upgradeLevel };
  }

  get branch(): UpgradeBranch | null {
    return branchOf(this.definition, this.branchId);
  }

  get applied(): GuardianUpgrade[] {
    return appliedUpgrades(this.definition, this.progress);
  }

  get options(): UpgradeOption[] {
    return upgradeOptions(this.definition, this.progress);
  }

  get branchStatuses(): BranchStatus[] {
    return branchStatuses(this.definition, this.progress);
  }

  get maxUpgradeLevel(): number {
    return MAX_UPGRADE_LEVEL;
  }

  get invested(): number {
    return investedValue(this.definition, this.progress);
  }

  sellValueAt(refundRate: number): number {
    return sellValue(this.invested, refundRate);
  }

  applyUpgrade(branchId: BranchId, now: number): boolean {
    const next = applyUpgrade(this.definition, this.progress, branchId);
    if (!next) return false;
    this.branchId = next.branchId;
    this.upgradeLevel = next.upgradeLevel;
    this.invalidateStats();
    this.runtime.syncStats(this.stats, now);
    this.drawBody();
    this.drawBadge();
    this.syncArtTexture();
    return true;
  }

  setAura(aura: ResolvedAura): void {
    if (sameAura(this.aura, aura)) return;
    this.aura = { ...aura };
    this.invalidateStats();
    this.drawBadge();
  }

  /** Bônus temporário de velocidade de ataque (Frenesi); só reescala a FSM quando muda. */
  setAttackSpeedBonus(bonus: number): void {
    if (Math.abs(this.runtime.attackSpeedBonus - bonus) < 1e-6) return;
    this.runtime.attackSpeedBonus = bonus;
    this.invalidateStats();
  }

  // ------------------------------------------------------------ atributos

  /** Atributos efetivos (definição + upgrades + aura + frenesi), com cache. */
  get stats(): GuardianStats {
    if (!this.cachedStats) {
      this.cachedStats = resolveGuardianStats(this.definition, this.progress, this.aura, {
        attackSpeedBonus: this.runtime.attackSpeedBonus,
      });
    }
    return this.cachedStats;
  }

  get range(): number {
    return this.stats.range;
  }

  get damage(): number {
    return this.stats.damage;
  }

  get canAttack(): boolean {
    return this.stats.canAttack;
  }

  get cooldownMs(): number {
    return this.stats.cooldownMs;
  }

  get blocks(): boolean {
    return this.stats.blocks;
  }

  /** Aura que esta unidade fornece aos aliados (Polvo, ramo Maré Aliada). */
  get providedAura(): GuardianUpgrade["aura"] | null {
    return this.stats.providedAura;
  }

  private invalidateStats(): void {
    this.cachedStats = null;
    this.fsm.setTimings(scaledTimings(this.definition, this.stats.cooldownMs));
  }

  // ------------------------------------------------------------------ tick

  tick(now: number, enemies: readonly Enemy[], onImpact: (guardian: Guardian, target: Enemy) => void): void {
    if (this.canAttack) {
      if (this.fsm.state === "idle") {
        const target = this.findTarget(enemies, now);
        if (target) this.processEvents(this.fsm.beginAttack(target.instanceId, now), enemies, onImpact);
      }
      const target = enemies.find((enemy) => enemy.instanceId === this.fsm.targetId);
      const valid = Boolean(target && !target.dead && !target.reachedGoal && target.distanceTo(this.x, this.y) <= this.range);
      if (target && valid) this.dashTarget = { x: target.x, y: target.y };
      this.processEvents(this.fsm.update(now, valid), enemies, onImpact);
    }
    this.animatePassiveVisual(now);
  }

  private findTarget(enemies: readonly Enemy[], now: number): Enemy | undefined {
    return selectTarget(enemies, this, this.range, targetPolicyFor(this, now));
  }

  private processEvents(
    events: readonly GuardianFsmEvent[],
    enemies: readonly Enemy[],
    onImpact: (guardian: Guardian, target: Enemy) => void,
  ): void {
    for (const event of events) {
      if (event.type === "transition") {
        this.visualState = event.transition.current;
        if (this.visualState === "idle") this.dashTarget = null;
        this.applyStateVisual();
      } else {
        const target = enemies.find((enemy) => enemy.instanceId === event.targetId);
        if (target && !target.dead && !target.reachedGoal) {
          this.attacksPerformed += 1;
          onImpact(this, target);
        }
      }
    }
  }

  // ---------------------------------------------------------------- visual

  /** Armadilha (Peixe-Pedra): a fase decide entre enterrado (`idle`) e emergido (`attack`). */
  setTrapPhase(phase: TrapPhase): void {
    this.trapPhase = phase;
    this.applyStateVisual();
  }

  private applyStateVisual(): void {
    if (this.visualState !== "idle") {
      this.bodyGraphic.y = 0;
      if (this.artSprite) this.artSprite.y = this.artBaselineY;
    }
    this.setAlpha(this.visualState === "disabled" ? 0.45 : 1);

    if (this.artSprite) {
      this.setScale(1);
      this.syncArtTexture();
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
      default:
        this.setScale(1);
    }
  }

  private animatePassiveVisual(now: number): void {
    // O idle só flutua levemente: nunca alterna entre variantes/evoluções.
    const bob = Math.sin(now / 420 + this.x) * (this.visualState === "idle" ? 1.8 : 0.8);
    const dash = this.dashOffset(now);
    const buried = this.trapPhase === "arming" || this.trapPhase === "armed";
    const trapAlpha = this.trapPhase === "cooldown" ? 0.7 : this.trapPhase === "arming" ? 0.85 : 1;
    if (this.artSprite) {
      this.artSprite.y = this.artBaselineY + bob + dash.y + (buried ? 6 : 0);
      this.artSprite.x = dash.x + (this.visualState === "attack" ? -4 : this.visualState === "recovery" ? -2 : 0);
      this.artSprite.setAngle(dash.angle ?? (this.visualState === "attack" ? -2 : 0));
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
    if (!this.stats.dash || !this.dashTarget || this.visualState === "idle" || this.visualState === "disabled") return none;
    const dx = this.dashTarget.x - this.x;
    const dy = this.dashTarget.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return none;
    const reach = Math.max(0, Math.min(distance - 18, this.range));
    const snapshot = this.fsm.snapshot();
    const duration = snapshot.stateDurationMs ?? 1;
    const elapsed = Math.max(0, Math.min(1, (now - snapshot.stateStartedAt) / Math.max(1, duration)));
    const speed = Math.max(1, this.stats.dashSpeedMultiplier);
    let fraction = 0;
    if (this.visualState === "windup") fraction = Math.min(1, elapsed * speed);
    else if (this.visualState === "attack") fraction = 1;
    else fraction = 1 - Math.min(1, elapsed * speed);
    const eased = fraction * fraction * (3 - 2 * fraction);
    return {
      x: (dx / distance) * reach * eased,
      y: (dy / distance) * reach * eased,
      angle: eased > 0.05 ? Phaser.Math.RadToDeg(Math.atan2(dy, dx)) * 0.25 : null,
    };
  }

  private get artVisualState(): "idle" | "attack" {
    if (this.trapPhase) return this.trapPhase === "triggered" || this.trapPhase === "cooldown" ? "attack" : "idle";
    return this.visualState === "idle" || this.visualState === "disabled" ? "idle" : "attack";
  }

  private syncArtTexture(): void {
    if (!this.artSprite) return;
    const texture = this.artTexture(this.artVisualState);
    if (this.artSprite.texture.key !== texture && this.scene.textures.exists(texture)) this.artSprite.setTexture(texture);
  }

  /** Anel colorido do ramo escolhido + marcadores de nível; halo quando recebe aura. */
  private drawBadge(): void {
    this.badgeGraphic.clear();
    const buffed = !sameAura(this.aura, NEUTRAL_AURA);
    if (buffed) {
      this.badgeGraphic.lineStyle(2, 0xffc3f0, 0.55);
      this.badgeGraphic.strokeCircle(0, 6, 40);
    }
    const branch = this.branch;
    if (!branch) return;
    this.badgeGraphic.lineStyle(4, branch.color, 0.95);
    this.badgeGraphic.strokeCircle(0, 6, 34);
    this.badgeGraphic.fillStyle(branch.color, 1);
    for (let index = 0; index < this.upgradeLevel; index += 1) {
      this.badgeGraphic.fillCircle(-7 + index * 14, 44, 5);
      this.badgeGraphic.lineStyle(2, 0x03212f, 1);
      this.badgeGraphic.strokeCircle(-7 + index * 14, 44, 5);
    }
  }

  private drawBody(): void {
    const primary = this.definition.color;
    const accent = this.definition.accent;
    const graphic = this.bodyGraphic;
    graphic.clear();
    graphic.fillStyle(0x001823, 0.35);
    graphic.fillEllipse(0, 18, 62, 18);

    switch (this.definition.id) {
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
        const heavy = this.branchId === "b" ? 1 + this.upgradeLevel * 0.12 : 1;
        graphic.fillStyle(primary, 1);
        graphic.fillEllipse(0, 0, 66 * heavy, 24 * heavy);
        graphic.fillTriangle(-2, -12 * heavy, 12, -12 * heavy, 4, -30 * heavy);
        graphic.fillTriangle(-30 * heavy, 0, -46 * heavy, -16, -46 * heavy, 14);
        graphic.fillStyle(0xdbe8f0, 1);
        graphic.fillEllipse(6, 6, 50 * heavy, 10 * heavy);
        if (this.branchId === "a" && this.upgradeLevel > 0) {
          graphic.lineStyle(3, accent, 0.7);
          for (let index = 1; index <= this.upgradeLevel + 1; index += 1) graphic.lineBetween(-20 - index * 10, -6 + index * 3, -34 - index * 10, -6 + index * 3);
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
        const shell = this.branchId === "a" ? 1 + this.upgradeLevel * 0.15 : 1;
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
        graphic.fillStyle(this.branchId === "a" ? 0x5b6b3a : 0x2f7a5a, 1);
        graphic.fillEllipse(0, 0, 50 * shell, 34 * shell);
        graphic.lineStyle(2, this.branchId === "b" && this.upgradeLevel > 0 ? 0x6fe3ff : accent, this.branchId === "b" ? 0.9 : 0.6);
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
        const tint = this.branchId === "a" && this.upgradeLevel > 0 ? 0xffd76a : this.branchId === "b" && this.upgradeLevel > 0 ? 0x9b7bff : accent;
        graphic.fillStyle(primary, 1);
        graphic.fillEllipse(0, 0, 60, 22);
        graphic.fillTriangle(-4, -10, 8, -10, 0, -24);
        graphic.fillTriangle(-26, 0, -40, -12, -40, 10);
        graphic.fillTriangle(26, -3, 40, 0, 26, 5);
        graphic.fillStyle(0xe6f7ff, 1);
        graphic.fillEllipse(4, 6, 42, 9);
        graphic.lineStyle(2, tint, 0.85);
        graphic.strokeCircle(0, -2, 34);
        if (this.upgradeLevel > 1) graphic.strokeCircle(0, -2, 42);
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
