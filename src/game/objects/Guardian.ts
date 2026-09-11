import Phaser from "phaser";
import { shrimpTextureForLevel, type ShrimpVisualState } from "../assets/recifeOneAssets";
import { DEPTH } from "../constants";
import { NEUTRAL_AURA, sameAura } from "../core/Auras";
import { selectLeadingTarget } from "../core/Combat";
import { GuardianStateMachine, type GuardianFsmEvent } from "../core/GuardianStateMachine";
import {
  appliedUpgrades,
  applyUpgrade,
  branchOf,
  investedValue,
  MAX_UPGRADE_LEVEL,
  resolveLast,
  resolveProduct,
  sellValue,
  upgradeOptions,
  type UpgradeProgress,
} from "../core/UpgradeTree";
import type {
  AuraEffect,
  BranchId,
  GuardianDefinition,
  GuardianState,
  GuardianUpgrade,
  UpgradeBranch,
  UpgradeOption,
  VulnerabilityEffect,
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
  branchId: BranchId | null = null;
  upgradeLevel = 0;
  /** Contador de golpes para habilidades "a cada N ataques" (giro do Caranguejo). */
  attacksPerformed = 0;
  aura: AuraEffect = NEUTRAL_AURA;

  private readonly bodyGraphic: Phaser.GameObjects.Graphics;
  private readonly badgeGraphic: Phaser.GameObjects.Graphics;
  private readonly artSprite: Phaser.GameObjects.Image | null;
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
    this.fsm = new GuardianStateMachine(this.scaledTimings());
    this.bodyGraphic = scene.add.graphics();
    this.badgeGraphic = scene.add.graphics();
    this.add([this.bodyGraphic, this.badgeGraphic]);
    const shrimpIdleTexture = shrimpTextureForLevel(0, "idle");
    if (definition.id === "pistol-shrimp" && scene.textures.exists(shrimpIdleTexture)) {
      this.artSprite = new Phaser.GameObjects.Image(scene, 0, this.artBaselineY, shrimpIdleTexture);
      this.artSprite.setOrigin(0.5, 1).setScale(0.88);
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
    return this.artSprite ? `shrimp-level-${this.upgradeLevel}-${this.shrimpVisualState}` : this.visualState;
  }

  get currentTextureKey(): string | null {
    return this.artSprite?.texture.key ?? null;
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

  get maxUpgradeLevel(): number {
    return MAX_UPGRADE_LEVEL;
  }

  get invested(): number {
    return investedValue(this.definition, this.progress);
  }

  sellValueAt(refundRate: number): number {
    return sellValue(this.invested, refundRate);
  }

  applyUpgrade(branchId: BranchId): boolean {
    const next = applyUpgrade(this.definition, this.progress, branchId);
    if (!next) return false;
    this.branchId = next.branchId;
    this.upgradeLevel = next.upgradeLevel;
    this.drawBody();
    this.drawBadge();
    this.syncArtTexture();
    this.fsm.setTimings(this.scaledTimings());
    return true;
  }

  setAura(aura: AuraEffect): void {
    if (sameAura(this.aura, aura)) return;
    this.aura = { ...aura };
    this.fsm.setTimings(this.scaledTimings());
    this.drawBadge();
  }

  // ------------------------------------------------------------ atributos

  get range(): number {
    return this.definition.range * resolveProduct(this.applied, "rangeMultiplier") * this.aura.rangeMultiplier;
  }

  get damage(): number {
    return resolveLast(this.applied, "damage") ?? this.definition.damage;
  }

  get canAttack(): boolean {
    return this.damage > 0;
  }

  get cooldownMs(): number {
    return (resolveLast(this.applied, "cooldownMs") ?? this.definition.cooldownMs) / this.aura.attackSpeedMultiplier;
  }

  get projectileSpeed(): number {
    return (this.definition.projectileSpeed ?? 400) * resolveProduct(this.applied, "projectileSpeedMultiplier");
  }

  get predictiveAim(): boolean {
    return this.applied.some((upgrade) => upgrade.predictiveAim);
  }

  get pierceDamages(): number[] {
    return resolveLast(this.applied, "pierceDamages") ?? [this.damage];
  }

  get straightRicochet(): boolean {
    return this.applied.some((upgrade) => upgrade.straightRicochet);
  }

  get splash(): NonNullable<GuardianUpgrade["splash"]> | null {
    return resolveLast(this.applied, "splash") ?? null;
  }

  get chainDamages(): number[] {
    return resolveLast(this.applied, "chainDamages") ?? [this.damage];
  }

  get slowFactor(): number | null {
    return resolveLast(this.applied, "slowFactor") ?? this.definition.slowFactor ?? null;
  }

  get slowDurationMs(): number {
    return resolveLast(this.applied, "slowDurationMs") ?? this.definition.slowDurationMs ?? 0;
  }

  get stun(): NonNullable<GuardianUpgrade["stun"]> | null {
    return resolveLast(this.applied, "stun") ?? null;
  }

  get electricField(): NonNullable<GuardianUpgrade["electricField"]> | null {
    return resolveLast(this.applied, "electricField") ?? null;
  }

  get blocks(): boolean {
    return this.definition.placementMode === "route" && Boolean(this.definition.blocks);
  }

  get blockCapacity(): number {
    if (!this.blocks) return 0;
    return resolveLast(this.applied, "blockCapacity") ?? this.definition.blockCapacity ?? 1;
  }

  get contactDamagePerSecond(): number {
    return resolveLast(this.applied, "contactDamagePerSecond") ?? this.definition.contactDamagePerSecond ?? 0;
  }

  get bossHold(): NonNullable<GuardianUpgrade["bossHold"]> | null {
    return resolveLast(this.applied, "bossHold") ?? null;
  }

  get armorPiercing(): boolean {
    return this.applied.some((upgrade) => upgrade.armorPiercing);
  }

  get vulnerability(): VulnerabilityEffect | null {
    return resolveLast(this.applied, "vulnerability") ?? this.definition.vulnerability ?? null;
  }

  get areaAttack(): boolean {
    return this.applied.some((upgrade) => upgrade.areaAttack);
  }

  get spin(): NonNullable<GuardianUpgrade["spin"]> | null {
    return resolveLast(this.applied, "spin") ?? null;
  }

  get inkCloud(): NonNullable<GuardianUpgrade["inkCloud"]> | null {
    return resolveLast(this.applied, "inkCloud") ?? null;
  }

  /** Aura que esta unidade fornece aos aliados (Polvo, ramo Maré Aliada). */
  get providedAura(): AuraEffect | null {
    return resolveLast(this.applied, "aura") ?? null;
  }

  // ------------------------------------------------------------------ tick

  tick(now: number, enemies: readonly Enemy[], onImpact: (guardian: Guardian, target: Enemy) => void): void {
    if (this.canAttack) {
      if (this.fsm.state === "idle") {
        const target = this.findTarget(enemies);
        if (target) this.processEvents(this.fsm.beginAttack(target.instanceId, now), enemies, onImpact);
      }
      const target = enemies.find((enemy) => enemy.instanceId === this.fsm.targetId);
      const valid = Boolean(target && !target.dead && !target.reachedGoal && target.distanceTo(this.x, this.y) <= this.range);
      this.processEvents(this.fsm.update(now, valid), enemies, onImpact);
    }
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
        if (target && !target.dead && !target.reachedGoal) {
          this.attacksPerformed += 1;
          onImpact(this, target);
        }
      }
    }
  }

  /** Escala os tempos de animação para que o ciclo completo dure `cooldownMs`. */
  private scaledTimings() {
    const base = this.definition.timings;
    const baseTotal = base.windupMs + base.attackMs + base.recoveryMs;
    const scale = baseTotal > 0 ? this.cooldownMs / baseTotal : 1;
    return {
      windupMs: base.windupMs * scale,
      attackMs: base.attackMs * scale,
      recoveryMs: base.recoveryMs * scale,
      impactAtMs: this.definition.animation.impactAtMs * scale,
    };
  }

  // ---------------------------------------------------------------- visual

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
    const bob = Math.sin(now / 420 + this.x) * (this.visualState === "idle" ? 1.8 : 0.8);
    if (this.artSprite) {
      this.artSprite.y = this.artBaselineY + bob;
      this.artSprite.x = this.visualState === "attack" ? -4 : this.visualState === "recovery" ? -2 : 0;
      this.artSprite.setAngle(this.visualState === "attack" ? -2 : 0);
    } else if (this.visualState === "idle") {
      this.bodyGraphic.y = bob;
    }
  }

  private get shrimpVisualState(): ShrimpVisualState {
    return this.visualState === "idle" || this.visualState === "disabled" ? "idle" : "attack";
  }

  private syncArtTexture(): void {
    if (!this.artSprite) return;
    const texture = shrimpTextureForLevel(this.upgradeLevel, this.shrimpVisualState);
    if (this.artSprite.texture.key !== texture) this.artSprite.setTexture(texture);
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
    }
  }
}
