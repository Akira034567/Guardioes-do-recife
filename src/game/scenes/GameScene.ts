import Phaser from "phaser";
import { SHRIMP_LEVEL_TEXTURES, shrimpProjectileTextureForLevel } from "../assets/recifeOneAssets";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { AbilityCooldown } from "../core/AbilityCooldown";
import { resolveAura, type AuraSource } from "../core/Auras";
import { hasReachedBlockerContact } from "../core/Combat";
import { Economy } from "../core/Economy";
import type { LevelProgress } from "../core/LevelProgress";
import { RoutePath } from "../core/RoutePath";
import { WaveScheduler, type WaveSchedulerEvent } from "../core/WaveScheduler";
import { BOSS_CURRENT, ECONOMY, GUARDIAN_BALANCE } from "../data/balance";
import { ENEMIES, scaleEnemy } from "../data/enemies";
import { GUARDIANS } from "../data/guardians";
import { getLevel, LEVELS, levelIndex, nextLevelId } from "../data/levels";
import { EventBus, Events } from "../EventBus";
import { Enemy } from "../objects/Enemy";
import { Guardian } from "../objects/Guardian";
import { Projectile } from "../objects/Projectile";
import { AudioManager } from "../systems/AudioManager";
import { DebugOverlay } from "../systems/DebugOverlay";
import { drawLevelBackdrop } from "../systems/LevelBackdrop";
import { createLevelProgress } from "../systems/ProgressStore";
import type {
  BranchId,
  DebugFlags,
  GuardianId,
  HudSnapshot,
  LevelDefinition,
  PlacementDefinition,
  PlacementMode,
  Vec2,
} from "../types";

const ROUTE_PLACEMENT_CLEARANCE = 52;
const ROUTE_UNIT_SEPARATION = 78;
const WATER_ROUTE_CLEARANCE = 82;
const WATER_SEPARATION = 78;

interface PlacementView {
  definition: PlacementDefinition;
  guardian: Guardian | null;
  zone: Phaser.GameObjects.Zone;
}

interface RoutePlacementView extends Vec2 {
  id: string;
  progress: number;
  routeDistance: number;
  guardian: Guardian | null;
}

interface ElectricFieldView {
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  durationMs: number;
  expiresAt: number;
  nextPulseAt: number;
  pulseIntervalMs: number;
  damage: number;
  maxDamagePerTarget: number;
  slowFactor: number;
  slowDurationMs: number;
  damageDealt: Map<string, number>;
  graphic: Phaser.GameObjects.Graphics;
}

interface InkCloudView {
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  durationMs: number;
  expiresAt: number;
  slowFactor: number;
  vulnerabilityMultiplier: number;
  graphic: Phaser.GameObjects.Graphics;
}

interface DamageOptions {
  sound?: boolean;
  continuous?: boolean;
  armorPiercing?: boolean;
}

const PLACEMENT_HINTS: Record<PlacementMode, string> = {
  platform: "uma plataforma de pedra",
  water: "uma área livre da água",
  route: "qualquer ponto da correnteza",
};

export class GameScene extends Phaser.Scene {
  private level: LevelDefinition = LEVELS[0];
  private progress!: LevelProgress;
  private route!: RoutePath;
  private economy!: Economy;
  private scheduler!: WaveScheduler;
  private audio!: AudioManager;
  private debugOverlay!: DebugOverlay;
  private selectionGraphic!: Phaser.GameObjects.Graphics;
  private placementGuideGraphic!: Phaser.GameObjects.Graphics;
  private placementPreviewGraphic!: Phaser.GameObjects.Graphics;
  private placementPreviewText!: Phaser.GameObjects.Text;
  private debugFlags!: DebugFlags;
  private placements: PlacementView[] = [];
  private routePlacements: RoutePlacementView[] = [];
  private electricFields: ElectricFieldView[] = [];
  private inkClouds: InkCloudView[] = [];
  private abilityCooldowns = new Map<string, AbilityCooldown>();
  private enemies: Enemy[] = [];
  private guardians: Guardian[] = [];
  private projectiles: Projectile[] = [];
  private currentMotes: Array<{ mote: Phaser.GameObjects.Arc; zoneIndex: number }> = [];
  private selectedGuardianId: GuardianId | null = null;
  private selectedPlacedGuardianId: string | null = null;
  private reefHealth: number = ECONOMY.reefHealth;
  private gameOver: "victory" | "defeat" | null = null;
  private unlockedNextLevelId: string | null = null;
  private paused = false;
  private currentReversed = false;
  private bossCycleMs = 0;
  private bossReverseRemainingMs = 0;
  private simulationTimeMs = 0;
  private enemySerial = 0;
  private guardianSerial = 0;
  private routeSerial = 0;
  private message = "";
  private messageUntilMs = 5_000;
  private hudAccumulatorMs = 0;
  private debugAccumulatorMs = 0;
  private readonly unlockAudio = (): void => this.audio?.unlock();

  constructor() {
    super("GameScene");
  }

  init(data: { levelId?: string } = {}): void {
    const requested = data.levelId ?? new URLSearchParams(window.location.search).get("level");
    this.level = getLevel(requested) ?? LEVELS[0];
  }

  create(): void {
    this.progress = createLevelProgress();
    this.enemies = [];
    this.guardians = [];
    this.projectiles = [];
    this.currentMotes = [];
    this.placements = [];
    this.routePlacements = [];
    this.electricFields = [];
    this.inkClouds = [];
    this.abilityCooldowns = new Map();
    this.selectedGuardianId = null;
    this.selectedPlacedGuardianId = null;
    this.reefHealth = this.level.reefHealth;
    this.gameOver = null;
    this.unlockedNextLevelId = null;
    this.paused = false;
    this.currentReversed = false;
    this.bossCycleMs = 0;
    this.bossReverseRemainingMs = 0;
    this.simulationTimeMs = 0;
    this.enemySerial = 0;
    this.guardianSerial = 0;
    this.routeSerial = 0;
    this.message = "Escolha um Guardião e toque em uma plataforma.";
    this.messageUntilMs = 5_000;
    this.hudAccumulatorMs = 0;
    this.debugAccumulatorMs = 0;
    this.route = new RoutePath(this.level.waypoints);
    this.economy = new Economy(this.level.startingPearls);
    const query = new URLSearchParams(window.location.search);
    const debugFromQuery = query.get("debug") === "1";
    // Atalho de debug: `?debug=1&wave=5` começa direto na onda indicada.
    const startWave = debugFromQuery ? Number(query.get("wave") ?? 1) - 1 : 0;
    this.scheduler = new WaveScheduler(
      this.level.waves,
      this.level.initialWaveDelayMs,
      this.level.betweenWaveDelayMs,
      Number.isFinite(startWave) ? startWave : 0,
    );
    this.audio = new AudioManager();
    this.debugFlags = {
      enabled: debugFromQuery,
      route: true,
      ranges: true,
      hitboxes: true,
      current: true,
      states: true,
      targets: true,
      placements: true,
    };

    this.drawEnvironment();
    this.createCurrentMotes();
    this.createPlacements();
    this.selectionGraphic = this.add.graphics().setDepth(DEPTH.effects);
    this.placementGuideGraphic = this.add.graphics().setDepth(DEPTH.effects - 1);
    this.placementPreviewGraphic = this.add.graphics().setDepth(DEPTH.effects + 1);
    this.placementPreviewText = this.add
      .text(0, 0, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: "rgba(0, 20, 31, .9)",
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.effects + 2)
      .setVisible(false);
    this.debugOverlay = new DebugOverlay(this, this.route);
    this.registerEvents();
    this.game.canvas.addEventListener("pointerdown", this.unlockAudio, { passive: true });
    this.game.canvas.dataset.screen = "game";
    this.game.canvas.dataset.level = this.level.id;
    this.scene.launch("UIScene", { debugFromQuery });
    this.emitHud();
  }

  update(_time: number, delta: number): void {
    if (this.paused || this.gameOver) return;
    const safeDelta = Math.min(delta, 80);
    this.simulationTimeMs += safeDelta;
    this.hudAccumulatorMs += safeDelta;
    this.debugAccumulatorMs += safeDelta;

    this.updateBossCurrent(safeDelta);
    this.updateCurrentMotes(safeDelta);

    const waveEvents = this.scheduler.tick(safeDelta, this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal).length);
    this.processWaveEvents(waveEvents);

    this.updateBlockers(safeDelta);

    for (const enemy of this.enemies) {
      const result = enemy.tick(this.simulationTimeMs, safeDelta, this.level.currents, this.currentReversed);
      if (result.reachedGoal) {
        this.reefHealth = Math.max(0, this.reefHealth - enemy.definition.reefDamage);
        this.audio.play("warning");
        this.showMessage(`${enemy.definition.name} atingiu o Recife! (-${enemy.definition.reefDamage})`, 1400);
        if (this.reefHealth <= 0) this.finishGame("defeat");
      }
    }

    this.updateAuras();
    for (const guardian of this.guardians) {
      guardian.tick(this.simulationTimeMs, this.enemies, (attacker, target) => this.resolveGuardianAttack(attacker, target));
    }

    this.updateElectricFields();
    this.updateInkClouds();

    for (const projectile of this.projectiles) {
      const result = projectile.tick(safeDelta, this.level.currents, this.currentReversed, this.enemies);
      result.hits.forEach((hit) => this.damageEnemy(hit.enemy, hit.damage, { sound: !hit.splash }));
      if (result.expired) projectile.destroy();
    }

    this.projectiles = this.projectiles.filter((projectile) => projectile.active);
    this.cleanupEnemies();

    if (this.debugAccumulatorMs >= 80) {
      this.debugAccumulatorMs = 0;
      this.renderDebug();
    }
    if (this.hudAccumulatorMs >= 100) {
      this.hudAccumulatorMs = 0;
      if (this.simulationTimeMs >= this.messageUntilMs) this.message = "";
      this.emitHud();
    }
  }

  // ------------------------------------------------------------------ eventos

  private registerEvents(): void {
    EventBus.on(Events.selectGuardian, this.selectGuardian, this);
    EventBus.on(Events.upgradeGuardian, this.upgradeSelectedGuardian, this);
    EventBus.on(Events.sellGuardian, this.sellSelectedGuardian, this);
    EventBus.on(Events.togglePause, this.togglePause, this);
    EventBus.on(Events.toggleMute, this.toggleMute, this);
    EventBus.on(Events.restart, this.restartGame, this);
    EventBus.on(Events.skipCountdown, this.skipCountdown, this);
    EventBus.on(Events.toggleDebug, this.toggleDebug, this);
    EventBus.on(Events.toggleDebugFlag, this.toggleDebugFlag, this);
    EventBus.on(Events.startLevel, this.startLevel, this);
    EventBus.on(Events.openLevelSelect, this.openLevelSelect, this);
    this.input.on("pointermove", this.handleWorldPointerMove, this);
    this.input.on("pointerdown", this.handleWorldPointerDown, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(Events.selectGuardian, this.selectGuardian, this);
      EventBus.off(Events.upgradeGuardian, this.upgradeSelectedGuardian, this);
      EventBus.off(Events.sellGuardian, this.sellSelectedGuardian, this);
      EventBus.off(Events.togglePause, this.togglePause, this);
      EventBus.off(Events.toggleMute, this.toggleMute, this);
      EventBus.off(Events.restart, this.restartGame, this);
      EventBus.off(Events.skipCountdown, this.skipCountdown, this);
      EventBus.off(Events.toggleDebug, this.toggleDebug, this);
      EventBus.off(Events.toggleDebugFlag, this.toggleDebugFlag, this);
      EventBus.off(Events.startLevel, this.startLevel, this);
      EventBus.off(Events.openLevelSelect, this.openLevelSelect, this);
      this.input.off("pointermove", this.handleWorldPointerMove, this);
      this.input.off("pointerdown", this.handleWorldPointerDown, this);
      this.game.canvas.removeEventListener("pointerdown", this.unlockAudio);
      this.audio.destroy();
      this.debugOverlay.destroy();
    });
  }

  private selectGuardian(id: GuardianId): void {
    if (this.gameOver) return;
    this.selectedGuardianId = this.selectedGuardianId === id ? null : id;
    this.selectedPlacedGuardianId = null;
    if (this.selectedGuardianId) {
      const definition = GUARDIANS[id];
      this.showMessage(`Toque em ${PLACEMENT_HINTS[definition.placementMode]} para posicionar ${definition.name}.`, 2200);
    }
    this.emitHud();
    this.renderPlacementState();
  }

  // ------------------------------------------------------------ posicionamento

  private handlePlacement(placement: PlacementView): void {
    this.audio.unlock();
    if (this.gameOver) return;
    if (placement.guardian) {
      this.selectPlacedGuardian(placement.guardian);
      return;
    }

    if (!this.selectedGuardianId) {
      if (this.selectedPlacedGuardianId) {
        this.clearPlacedSelection();
        return;
      }
      this.showMessage("Escolha primeiro um Guardião no painel inferior.", 1800);
      return;
    }

    const definition = GUARDIANS[this.selectedGuardianId];
    if (definition.placementMode !== "platform") {
      this.showMessage(`${definition.name} precisa de ${PLACEMENT_HINTS[definition.placementMode]}.`, 1900);
      return;
    }

    const guardian = this.placeGuardian(definition.id, placement.definition.x, placement.definition.y);
    if (!guardian) return;
    placement.guardian = guardian;
    this.showMessage(`${definition.name} protege esta plataforma!`, 1600);
  }

  private placeGuardian(
    guardianId: GuardianId,
    x: number,
    y: number,
    routePlacement?: RoutePlacementView,
  ): Guardian | null {
    const definition = GUARDIANS[guardianId];
    if (!this.economy.spend(definition.cost)) {
      this.showMessage(`Faltam pérolas para ${definition.name}.`, 1800);
      this.audio.play("warning");
      return null;
    }

    const guardian = new Guardian(
      this,
      `G${++this.guardianSerial}`,
      definition,
      x,
      y,
      routePlacement
        ? { routePlacementId: routePlacement.id, routeDistance: routePlacement.routeDistance }
        : {},
    );
    guardian.setSize(80, 80);
    guardian.setInteractive(new Phaser.Geom.Circle(40, 40, 40), Phaser.Geom.Circle.Contains);
    guardian.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        this.selectPlacedGuardian(guardian);
      },
    );
    this.guardians.push(guardian);
    if (routePlacement) {
      routePlacement.guardian = guardian;
      this.routePlacements.push(routePlacement);
    }
    this.selectedGuardianId = null;
    this.selectedPlacedGuardianId = guardian.instanceId;
    this.audio.play("buy");
    this.emitHud();
    this.renderPlacementState();
    return guardian;
  }

  private selectPlacedGuardian(guardian: Guardian): void {
    this.selectedPlacedGuardianId = guardian.instanceId;
    this.selectedGuardianId = null;
    const branch = guardian.branch ? ` · ${guardian.branch.name}` : "";
    this.showMessage(`${guardian.definition.name} · nível ${guardian.upgradeLevel}/${guardian.maxUpgradeLevel}${branch}`, 1400);
    this.emitHud();
    this.renderPlacementState();
  }

  private clearPlacedSelection(): void {
    this.selectedPlacedGuardianId = null;
    this.emitHud();
    this.renderPlacementState();
  }

  private handleWorldPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameOver || pointer.y <= HUD_TOP || pointer.y >= GAME_HEIGHT - HUD_BOTTOM) return;
    if (!this.selectedGuardianId) {
      if (this.selectedPlacedGuardianId) this.clearPlacedSelection();
      return;
    }
    const definition = GUARDIANS[this.selectedGuardianId];
    if (definition.placementMode === "water") {
      const validation = this.validateWaterPlacement(pointer.worldX, pointer.worldY);
      if (!validation.valid) {
        this.showMessage(validation.reason, 1500);
        this.audio.play("warning");
        return;
      }
      const guardian = this.placeGuardian(definition.id, pointer.worldX, pointer.worldY);
      if (guardian) this.showMessage(`${definition.name} posicionada na água.`, 1500);
    } else if (definition.placementMode === "route") {
      const validation = this.validateRoutePlacement(pointer.worldX, pointer.worldY);
      if (!validation.valid) {
        this.showMessage(validation.reason, 1700);
        this.audio.play("warning");
        return;
      }
      const placement: RoutePlacementView = {
        id: `rota-${++this.routeSerial}`,
        x: validation.x,
        y: validation.y,
        routeDistance: validation.routeDistance,
        progress: validation.progress,
        guardian: null,
      };
      const guardian = this.placeGuardian(definition.id, placement.x, placement.y, placement);
      if (guardian) {
        this.showMessage(
          definition.blocks ? `${definition.name} bloqueando a correnteza!` : `${definition.name} de guarda na correnteza!`,
          1500,
        );
      }
    }
  }

  private handleWorldPointerMove(pointer: Phaser.Input.Pointer): void {
    this.placementPreviewGraphic.clear();
    this.placementPreviewText.setVisible(false);
    if (!this.selectedGuardianId || pointer.y <= HUD_TOP || pointer.y >= GAME_HEIGHT - HUD_BOTTOM) return;
    const definition = GUARDIANS[this.selectedGuardianId];
    if (definition.placementMode === "platform") return;

    let x = pointer.worldX;
    let y = pointer.worldY;
    let valid = false;
    let label = "";
    if (definition.placementMode === "water") {
      const validation = this.validateWaterPlacement(x, y);
      valid = validation.valid;
      label = validation.valid ? "Posição válida" : validation.reason;
    } else {
      const validation = this.validateRoutePlacement(x, y);
      x = validation.x;
      y = validation.y;
      valid = validation.valid;
      label = validation.valid ? "Ponto livre da correnteza" : validation.reason;
    }

    this.placementPreviewGraphic.fillStyle(valid ? 0x67f2ac : 0xff6f79, 0.2);
    this.placementPreviewGraphic.lineStyle(3, valid ? 0x67f2ac : 0xff6f79, 0.95);
    this.placementPreviewGraphic.fillCircle(x, y, 34);
    this.placementPreviewGraphic.strokeCircle(x, y, 34);
    this.placementPreviewText.setPosition(x, y - 42).setText(label).setVisible(true);
  }

  private validateWaterPlacement(x: number, y: number): { valid: boolean; reason: string } {
    if (x < 44 || x > GAME_WIDTH - 44 || y < HUD_TOP + 38 || y > GAME_HEIGHT - HUD_BOTTOM - 38) {
      return { valid: false, reason: "Fora da área jogável" };
    }
    if (this.route.getClosestPoint({ x, y }).distance < WATER_ROUTE_CLEARANCE) {
      return { valid: false, reason: "Muito perto da rota" };
    }
    if (this.placements.some((placement) => Math.hypot(x - placement.definition.x, y - placement.definition.y) < WATER_SEPARATION)) {
      return { valid: false, reason: "Plataforma ocupa este espaço" };
    }
    if (this.guardians.some((guardian) => Math.hypot(x - guardian.x, y - guardian.y) < WATER_SEPARATION)) {
      return { valid: false, reason: "Muito perto de outro Guardião" };
    }
    return { valid: true, reason: "Posição válida" };
  }

  private validateRoutePlacement(x: number, y: number): {
    valid: boolean;
    reason: string;
    x: number;
    y: number;
    routeDistance: number;
    progress: number;
  } {
    const closest = this.route.getClosestPoint({ x, y });
    const result = {
      valid: true,
      reason: "Posição válida",
      x: closest.point.x,
      y: closest.point.y,
      routeDistance: closest.routeDistance,
      progress: closest.progress,
    };
    if (closest.distance > ROUTE_PLACEMENT_CLEARANCE) {
      return { ...result, valid: false, reason: "Toque dentro da correnteza" };
    }
    if (closest.routeDistance < 60 || closest.routeDistance > this.route.totalLength - 60) {
      return { ...result, valid: false, reason: "Muito perto da entrada ou do Recife" };
    }
    if (
      this.routePlacements.some(
        (placement) => Math.hypot(result.x - placement.x, result.y - placement.y) < ROUTE_UNIT_SEPARATION,
      )
    ) {
      return { ...result, valid: false, reason: "Muito perto de outro Guardião da correnteza" };
    }
    return result;
  }

  // -------------------------------------------------------- upgrade e venda

  private upgradeSelectedGuardian(branchId: BranchId): void {
    if (!this.selectedPlacedGuardianId || this.gameOver) return;
    const guardian = this.guardians.find((candidate) => candidate.instanceId === this.selectedPlacedGuardianId);
    if (!guardian) return;
    const option = guardian.options.find((candidate) => candidate.branchId === branchId);
    if (!option) return;
    if (!this.economy.canAfford(option.cost)) {
      this.showMessage("Pérolas insuficientes para este upgrade.", 1700);
      this.audio.play("warning");
      return;
    }
    if (!guardian.applyUpgrade(branchId)) return;
    this.economy.spend(option.cost);
    this.audio.play("upgrade");
    this.showMessage(`${option.name} adquirido! Ramo ${option.branchName}.`, 1900);
    this.emitHud();
    this.renderPlacementState();
  }

  private sellSelectedGuardian(): void {
    if (!this.selectedPlacedGuardianId || this.gameOver) return;
    const guardian = this.guardians.find((candidate) => candidate.instanceId === this.selectedPlacedGuardianId);
    if (!guardian) return;
    const refund = guardian.sellValueAt(ECONOMY.sellRefundRate);
    this.removeGuardian(guardian);
    this.economy.earn(refund);
    this.selectedPlacedGuardianId = null;
    this.audio.play("buy");
    this.showMessage(`${guardian.definition.name} vendido por ${refund} pérolas.`, 1800);
    this.emitHud();
    this.renderPlacementState();
  }

  /** Remove a unidade do mapa e libera a posição que ocupava. */
  private removeGuardian(guardian: Guardian): void {
    this.guardians = this.guardians.filter((candidate) => candidate !== guardian);
    this.placements.forEach((placement) => {
      if (placement.guardian === guardian) placement.guardian = null;
    });
    this.routePlacements = this.routePlacements.filter((placement) => placement.guardian !== guardian);
    this.electricFields = this.electricFields.filter((field) => {
      if (field.ownerId !== guardian.instanceId) return true;
      field.graphic.destroy();
      return false;
    });
    this.inkClouds = this.inkClouds.filter((cloud) => {
      if (cloud.ownerId !== guardian.instanceId) return true;
      cloud.graphic.destroy();
      return false;
    });
    this.abilityCooldowns.delete(guardian.instanceId);
    this.enemies.forEach((enemy) => {
      if (enemy.blockedById === guardian.instanceId) enemy.clearBlocked();
    });
    guardian.destroy();
  }

  // -------------------------------------------------------------- combate

  private resolveGuardianAttack(guardian: Guardian, target: Enemy): void {
    const definition = guardian.definition;
    switch (definition.attackKind) {
      case "projectile":
        this.fireProjectile(guardian, target);
        return;
      case "chain":
        this.resolveChain(guardian, target);
        return;
      case "melee":
        this.resolveMelee(guardian, target);
        return;
      case "ink":
        this.resolveInk(guardian, target);
        return;
      case "area":
      default:
        this.resolvePulse(guardian);
    }
  }

  private fireProjectile(guardian: Guardian, target: Enemy): void {
    const originX = guardian.x + 22;
    const originY = guardian.y;
    const shrimpBalance = GUARDIAN_BALANCE["pistol-shrimp"];
    this.projectiles.push(
      new Projectile(
        this,
        originX,
        originY,
        target,
        {
          speed: guardian.projectileSpeed,
          damages: guardian.pierceDamages,
          predictiveAim: guardian.predictiveAim,
          straightRicochet: guardian.straightRicochet,
          ricochetRange: shrimpBalance.ricochetRange,
          splash: guardian.splash ?? undefined,
          radius: 6,
          lifetimeMs: 2200,
          bounds: { minX: -80, maxX: GAME_WIDTH + 80, minY: -80, maxY: GAME_HEIGHT + 80 },
        },
        guardian.definition.id === "pistol-shrimp" ? shrimpProjectileTextureForLevel(guardian.upgradeLevel) : null,
      ),
    );
    this.audio.play("shot");
    this.shockwave(originX, originY, guardian.definition.accent, 34);
  }

  private resolveChain(guardian: Guardian, target: Enemy): void {
    const damages = guardian.chainDamages;
    const candidates = this.enemies
      .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= guardian.range)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, damages.length);
    const slowFactor = guardian.slowFactor;
    candidates.forEach((enemy, index) => {
      this.damageEnemy(enemy, damages[index] ?? damages[damages.length - 1]);
      if (slowFactor !== null) enemy.applySlow(slowFactor, guardian.slowDurationMs, this.simulationTimeMs);
    });
    const stun = guardian.stun;
    if (stun && !target.dead) {
      if (target.tryStun(stun.durationMs, stun.immunityMs, this.simulationTimeMs)) {
        this.shockwave(target.x, target.y, 0xfff27a, 26);
      }
    }
    this.lightningEffect(guardian, candidates);
    if (guardian.electricField) this.createElectricField(guardian, target.x, target.y);
    this.audio.play("zap");
  }

  private resolvePulse(guardian: Guardian): void {
    const slowFactor = guardian.slowFactor;
    this.enemies
      .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= guardian.range)
      .forEach((enemy) => {
        this.damageEnemy(enemy, guardian.damage);
        if (slowFactor !== null) enemy.applySlow(slowFactor, guardian.slowDurationMs, this.simulationTimeMs);
      });
    this.shockwave(guardian.x, guardian.y, guardian.definition.accent, guardian.range);
    this.audio.play("pulse");
  }

  private resolveMelee(guardian: Guardian, target: Enemy): void {
    const spin = guardian.spin;
    const spinning = spin !== null && guardian.attacksPerformed % spin.everyAttacks === 0;
    const radius = spinning ? guardian.range * spin.radiusMultiplier : guardian.range;
    const damage = spinning ? spin.damage : guardian.damage;
    const targets = guardian.areaAttack || spinning
      ? this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= radius)
      : [target];
    const vulnerability = guardian.vulnerability;
    targets.forEach((enemy) => {
      this.damageEnemy(enemy, damage, { armorPiercing: guardian.armorPiercing });
      if (vulnerability) enemy.applyVulnerability(vulnerability.multiplier, vulnerability.durationMs, this.simulationTimeMs);
    });
    this.shockwave(guardian.x, guardian.y, guardian.definition.accent, spinning ? radius : 30);
    this.audio.play(spinning ? "pulse" : "impact");
  }

  private resolveInk(guardian: Guardian, target: Enemy): void {
    const vulnerability = guardian.vulnerability;
    const affected = vulnerability?.radius
      ? this.enemies.filter(
          (enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(target.x, target.y) <= (vulnerability.radius ?? 0),
        )
      : [target];
    if (!affected.includes(target)) affected.push(target);
    affected.forEach((enemy) => {
      this.damageEnemy(enemy, enemy === target ? guardian.damage : Math.ceil(guardian.damage * 0.5), { sound: enemy === target });
      if (vulnerability) enemy.applyVulnerability(vulnerability.multiplier, vulnerability.durationMs, this.simulationTimeMs);
    });
    this.inkSplash(guardian, target);
    if (guardian.inkCloud) this.createInkCloud(guardian, target.x, target.y);
    this.audio.play("zap");
  }

  private damageEnemy(enemy: Enemy, damage: number, options: DamageOptions = {}): void {
    const killed = options.continuous
      ? enemy.takeContinuousDamage(damage)
      : enemy.takeDamage(damage, { armorPiercing: options.armorPiercing });
    if (options.sound ?? true) this.audio.play("impact");
    if (killed) {
      this.economy.earn(enemy.definition.reward);
      if (enemy.definition.isBoss) {
        this.currentReversed = false;
        this.showMessage(`${enemy.definition.name} caiu! A corrente se estabilizou.`, 2400);
      }
    }
  }

  private updateBlockers(deltaMs: number): void {
    const blockers = this.guardians.filter((guardian) => guardian.blocks && guardian.routeDistance !== null);
    const blockerIds = new Set(blockers.map((guardian) => guardian.instanceId));
    this.enemies.forEach((enemy) => {
      if (enemy.blockedById && !blockerIds.has(enemy.blockedById)) enemy.clearBlocked();
    });

    for (const blocker of blockers) {
      const anchor = blocker.routeDistance as number;
      const alreadyBlocked = this.enemies
        .filter((enemy) => enemy.blockedById === blocker.instanceId && !enemy.dead && !enemy.reachedGoal)
        .slice(0, blocker.blockCapacity);
      this.enemies
        .filter((enemy) => enemy.blockedById === blocker.instanceId && !alreadyBlocked.includes(enemy))
        .forEach((enemy) => enemy.clearBlocked());

      const inContact = this.enemies.filter(
        (enemy) =>
          !enemy.dead &&
          !enemy.reachedGoal &&
          !enemy.blockedById &&
          hasReachedBlockerContact(enemy.pathDistance, anchor, 28 + enemy.definition.hitRadius),
      );
      const candidates = inContact
        .filter((enemy) => enemy.isBlockable)
        .sort((first, second) => second.pathDistance - first.pathDistance);
      const blocked = [...alreadyBlocked, ...candidates.slice(0, Math.max(0, blocker.blockCapacity - alreadyBlocked.length))];
      blocked.forEach((enemy) => {
        enemy.setBlocked(blocker.instanceId, enemy.pathDistance);
        if (blocker.contactDamagePerSecond > 0) {
          this.damageEnemy(enemy, blocker.contactDamagePerSecond * (deltaMs / 1000), { sound: false, continuous: true });
        }
      });

      // Chefes não são bloqueados; a Fortaleza pode pausá-los por pouco tempo.
      const bossHold = blocker.bossHold;
      inContact
        .filter((enemy) => !enemy.isBlockable)
        .forEach((enemy) => {
          if (bossHold && enemy.tryHold(bossHold.durationMs, bossHold.immunityMs, this.simulationTimeMs)) {
            this.showMessage(`${blocker.definition.name} segurou ${enemy.definition.name} por um instante!`, 1500);
            this.shockwave(enemy.x, enemy.y, 0xffe082, 50);
          }
          if (enemy.status.isHeld(this.simulationTimeMs) && blocker.contactDamagePerSecond > 0) {
            this.damageEnemy(enemy, blocker.contactDamagePerSecond * (deltaMs / 1000), { sound: false, continuous: true });
          }
        });
    }
  }

  private updateAuras(): void {
    const sources: AuraSource[] = this.guardians
      .filter((guardian) => guardian.providedAura)
      .map((guardian) => ({
        id: guardian.instanceId,
        x: guardian.x,
        y: guardian.y,
        range: guardian.range,
        aura: guardian.providedAura!,
      }));
    this.guardians.forEach((guardian) => {
      guardian.setAura(resolveAura({ id: guardian.instanceId, x: guardian.x, y: guardian.y }, sources));
    });
  }

  private cooldownFor(guardianId: string): AbilityCooldown {
    let cooldown = this.abilityCooldowns.get(guardianId);
    if (!cooldown) {
      cooldown = new AbilityCooldown();
      this.abilityCooldowns.set(guardianId, cooldown);
    }
    return cooldown;
  }

  private createElectricField(guardian: Guardian, x: number, y: number): void {
    const definition = guardian.electricField;
    if (!definition) return;
    if (!this.cooldownFor(guardian.instanceId).tryActivate(this.simulationTimeMs, definition.cooldownMs)) return;
    this.electricFields = this.electricFields.filter((field) => {
      if (field.ownerId !== guardian.instanceId) return true;
      field.graphic.destroy();
      return false;
    });
    const graphic = this.add.graphics().setDepth(DEPTH.effects - 1);
    graphic.fillStyle(0x9e65ff, 0.13);
    graphic.fillCircle(x, y, definition.radius);
    graphic.lineStyle(3, 0x7deaff, 0.72);
    graphic.strokeCircle(x, y, definition.radius);
    graphic.lineStyle(1, 0xe5d3ff, 0.65);
    graphic.strokeCircle(x, y, definition.radius * 0.58);
    this.electricFields.push({
      ownerId: guardian.instanceId,
      x,
      y,
      radius: definition.radius,
      durationMs: definition.durationMs,
      expiresAt: this.simulationTimeMs + definition.durationMs,
      nextPulseAt: this.simulationTimeMs,
      pulseIntervalMs: definition.pulseIntervalMs,
      damage: definition.damage,
      maxDamagePerTarget: definition.maxDamagePerTarget,
      slowFactor: definition.slowFactor,
      slowDurationMs: definition.slowDurationMs,
      damageDealt: new Map(),
      graphic,
    });
  }

  private updateElectricFields(): void {
    this.electricFields = this.electricFields.filter((field) => {
      if (this.simulationTimeMs >= field.expiresAt) {
        field.graphic.destroy();
        return false;
      }
      const remaining = (field.expiresAt - this.simulationTimeMs) / field.durationMs;
      field.graphic.setAlpha(Math.max(0.18, Math.min(1, remaining)));
      if (this.simulationTimeMs >= field.nextPulseAt) {
        field.nextPulseAt += field.pulseIntervalMs;
        const affected = this.enemies.filter(
          (enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(field.x, field.y) <= field.radius,
        );
        affected.forEach((enemy) => {
          const dealt = field.damageDealt.get(enemy.instanceId) ?? 0;
          const allowed = Math.max(0, Math.min(field.damage, field.maxDamagePerTarget - dealt));
          if (allowed > 0) {
            field.damageDealt.set(enemy.instanceId, dealt + allowed);
            this.damageEnemy(enemy, allowed, { sound: false, continuous: true });
          }
          enemy.applySlow(field.slowFactor, field.slowDurationMs, this.simulationTimeMs);
        });
        if (affected.length > 0) {
          this.audio.play("zap");
          this.shockwave(field.x, field.y, 0x8ff4ff, field.radius);
        }
      }
      return true;
    });
  }

  private createInkCloud(guardian: Guardian, x: number, y: number): void {
    const definition = guardian.inkCloud;
    if (!definition) return;
    if (!this.cooldownFor(guardian.instanceId).tryActivate(this.simulationTimeMs, definition.cooldownMs)) return;
    this.inkClouds = this.inkClouds.filter((cloud) => {
      if (cloud.ownerId !== guardian.instanceId) return true;
      cloud.graphic.destroy();
      return false;
    });
    const graphic = this.add.graphics().setDepth(DEPTH.effects - 1);
    graphic.fillStyle(0x2a1a4a, 0.45);
    graphic.fillCircle(x, y, definition.radius);
    graphic.fillStyle(0x6b5bd6, 0.25);
    graphic.fillCircle(x - definition.radius * 0.25, y - definition.radius * 0.2, definition.radius * 0.6);
    graphic.lineStyle(2, 0xd58cff, 0.6);
    graphic.strokeCircle(x, y, definition.radius);
    this.inkClouds.push({
      ownerId: guardian.instanceId,
      x,
      y,
      radius: definition.radius,
      durationMs: definition.durationMs,
      expiresAt: this.simulationTimeMs + definition.durationMs,
      slowFactor: definition.slowFactor,
      vulnerabilityMultiplier: definition.vulnerabilityMultiplier,
      graphic,
    });
  }

  private updateInkClouds(): void {
    this.inkClouds = this.inkClouds.filter((cloud) => {
      if (this.simulationTimeMs >= cloud.expiresAt) {
        cloud.graphic.destroy();
        return false;
      }
      const remaining = (cloud.expiresAt - this.simulationTimeMs) / cloud.durationMs;
      cloud.graphic.setAlpha(Math.max(0.25, Math.min(1, remaining + 0.2)));
      this.enemies
        .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(cloud.x, cloud.y) <= cloud.radius)
        .forEach((enemy) => {
          enemy.applySlow(cloud.slowFactor, 320, this.simulationTimeMs);
          enemy.applyVulnerability(cloud.vulnerabilityMultiplier, 320, this.simulationTimeMs);
        });
      return true;
    });
  }

  private cleanupEnemies(): void {
    this.enemies = this.enemies.filter((enemy) => {
      if (!enemy.dead && !enemy.reachedGoal) return true;
      enemy.destroy();
      return false;
    });
  }

  // ------------------------------------------------------------------ ondas

  private processWaveEvents(events: readonly WaveSchedulerEvent[]): void {
    for (const event of events) {
      if (event.type === "spawn") {
        const definition = scaleEnemy(ENEMIES[event.enemyId], this.level.enemyScaling, this.level.enemyOverrides?.[event.enemyId]);
        this.enemies.push(new Enemy(this, `E${++this.enemySerial}`, definition, this.route));
      } else if (event.type === "waveStarted") {
        this.audio.play(event.waveIndex === this.level.waves.length - 1 ? "warning" : "wave");
        this.showMessage(`Onda ${event.waveIndex + 1}: ${this.level.waves[event.waveIndex].name}`, 2200);
      } else if (event.type === "waveCleared") {
        this.economy.earn(ECONOMY.waveClearBonus);
        this.showMessage(`Onda ${event.waveIndex + 1} vencida! +${ECONOMY.waveClearBonus} pérolas`, 1800);
      } else if (event.type === "victory") {
        this.economy.earn(ECONOMY.levelClearBonus);
        this.unlockedNextLevelId = this.progress.complete(this.level.id);
        this.finishGame("victory");
      }
    }
  }

  private updateBossCurrent(deltaMs: number): void {
    const boss = this.enemies.find((enemy) => enemy.definition.isBoss && !enemy.dead && !enemy.reachedGoal);
    if (!boss) {
      this.currentReversed = false;
      this.bossCycleMs = 0;
      this.bossReverseRemainingMs = 0;
      return;
    }

    if (this.currentReversed) {
      this.bossReverseRemainingMs -= deltaMs;
      if (this.bossReverseRemainingMs <= 0) {
        this.currentReversed = false;
        this.bossCycleMs = 0;
        this.showMessage("A corrente voltou ao fluxo normal.", 1300);
      }
    } else {
      this.bossCycleMs += deltaMs;
      if (this.bossCycleMs >= BOSS_CURRENT.cycleMs) {
        this.currentReversed = true;
        this.bossReverseRemainingMs = BOSS_CURRENT.reverseMs;
        this.audio.play("warning");
        this.showMessage(`${boss.definition.name} inverteu a corrente!`, 2200);
      }
    }
  }

  private finishGame(result: "victory" | "defeat"): void {
    if (this.gameOver) return;
    this.gameOver = result;
    this.message = result === "victory" ? `RECIFE PROTEGIDO! +${ECONOMY.levelClearBonus} pérolas` : "O RECIFE PRECISA DE REFORÇOS";
    this.messageUntilMs = Number.POSITIVE_INFINITY;
    this.audio.play(result === "victory" ? "upgrade" : "warning");
    this.emitHud();
  }

  // -------------------------------------------------------------- controles

  private togglePause(): void {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.emitHud();
    if (this.paused) this.scene.pause();
    else this.scene.resume();
  }

  private toggleMute(): void {
    this.audio.unlock();
    this.audio.toggleMute();
    this.emitHud();
  }

  private restartGame(): void {
    this.scene.stop("UIScene");
    this.scene.restart({ levelId: this.level.id });
  }

  private startLevel(levelId: string): void {
    if (!getLevel(levelId)) return;
    this.scene.stop("UIScene");
    this.scene.restart({ levelId });
  }

  private openLevelSelect(): void {
    this.scene.stop("UIScene");
    this.scene.start("LevelSelectScene");
  }

  private skipCountdown(): void {
    if (this.gameOver || this.paused || !this.scheduler.skipCountdown()) return;
    this.showMessage("Preparação encerrada. A onda começou!", 1300);
    this.audio.play("wave");
    this.emitHud();
  }

  private toggleDebug(): void {
    this.debugFlags.enabled = !this.debugFlags.enabled;
    this.emitHud();
    this.renderDebug();
  }

  private toggleDebugFlag(flag: keyof Omit<DebugFlags, "enabled">): void {
    this.debugFlags[flag] = !this.debugFlags[flag];
    this.emitHud();
    this.renderDebug();
  }

  private showMessage(message: string, durationMs: number): void {
    this.message = message;
    this.messageUntilMs = this.simulationTimeMs + durationMs;
    this.emitHud();
  }

  // -------------------------------------------------------------------- HUD

  private emitHud(): void {
    const selected = this.guardians.find((guardian) => guardian.instanceId === this.selectedPlacedGuardianId);
    const snapshot: HudSnapshot = {
      levelId: this.level.id,
      levelName: this.level.name,
      levelIndex: levelIndex(this.level.id),
      levelCount: LEVELS.length,
      nextLevelId: this.gameOver === "victory" ? (this.unlockedNextLevelId ?? nextLevelId(this.level.id)) : null,
      pearls: this.economy.pearls,
      reefHealth: this.reefHealth,
      maxReefHealth: this.level.reefHealth,
      wave: this.scheduler.currentWave,
      totalWaves: this.scheduler.totalWaves,
      waveState: this.scheduler.state,
      countdownSeconds: this.scheduler.countdownSeconds,
      canSkipCountdown: this.scheduler.state === "countdown",
      selectedGuardianId: this.selectedGuardianId,
      selectedPlacedGuardian: selected
        ? {
            instanceId: selected.instanceId,
            guardianId: selected.definition.id,
            name: selected.definition.name,
            upgradeLevel: selected.upgradeLevel,
            maxUpgradeLevel: selected.maxUpgradeLevel,
            branchId: selected.branchId,
            branchName: selected.branch?.name ?? null,
            branchColor: selected.branch?.color ?? null,
            options: selected.options,
            invested: selected.invested,
            sellValue: selected.sellValueAt(ECONOMY.sellRefundRate),
          }
        : null,
      paused: this.paused,
      muted: this.audio.isMuted,
      debug: { ...this.debugFlags },
      message: this.message,
      gameOver: this.gameOver,
    };
    const dataset = this.game.canvas.dataset;
    dataset.gameState = this.gameOver ?? this.scheduler.state;
    dataset.level = this.level.id;
    dataset.nextLevel = snapshot.nextLevelId ?? "";
    dataset.wave = String(this.scheduler.currentWave);
    dataset.pearls = String(this.economy.pearls);
    dataset.reef = String(this.reefHealth);
    dataset.guardians = String(this.guardians.length);
    dataset.upgrades = String(this.guardians.reduce((total, guardian) => total + guardian.upgradeLevel, 0));
    dataset.selected = this.selectedPlacedGuardianId ?? "";
    dataset.selectedBranch = selected?.branchId ?? "";
    dataset.selectedOptions = selected ? String(selected.options.length) : "";
    dataset.sellValue = selected ? String(selected.sellValueAt(ECONOMY.sellRefundRate)) : "";
    dataset.debug = String(this.debugFlags.enabled);
    dataset.paused = String(this.paused);
    const shrimp = this.guardians.find((guardian) => guardian.definition.id === "pistol-shrimp");
    dataset.shrimpAssets = String(this.textures.exists(SHRIMP_LEVEL_TEXTURES[0].idle));
    dataset.shrimpArt = String(shrimp?.usesSpriteArt ?? false);
    dataset.shrimpVisual = shrimp?.currentVisualKey ?? "";
    dataset.shrimpTexture = shrimp?.currentTextureKey ?? "";
    dataset.projectileTexture = this.projectiles.at(-1)?.textureKey ?? "";
    const boss = this.enemies.find((enemy) => enemy.definition.isBoss && !enemy.dead && !enemy.reachedGoal);
    dataset.boss = boss
      ? `${boss.x.toFixed(0)},${boss.y.toFixed(0)},${boss.effectiveSpeed.toFixed(1)},${Math.ceil(boss.health)},${boss.blockedById ?? "-"}`
      : "";
    dataset.enemies = String(this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal).length);
    EventBus.emit(Events.hudUpdate, snapshot);
  }

  private renderDebug(): void {
    this.debugOverlay.render(
      this.debugFlags,
      this.guardians,
      this.enemies,
      this.projectiles,
      this.level.currents,
      this.currentReversed,
      this.selectedPlacedGuardianId,
      {
        waterBounds: {
          x: 44,
          y: HUD_TOP + 38,
          width: GAME_WIDTH - 88,
          height: GAME_HEIGHT - HUD_BOTTOM - HUD_TOP - 76,
        },
        waterRouteClearance: WATER_ROUTE_CLEARANCE,
        waterSeparation: WATER_SEPARATION,
        routePlacementClearance: ROUTE_PLACEMENT_CLEARANCE,
        platforms: this.placements.map((placement) => ({
          x: placement.definition.x,
          y: placement.definition.y,
        })),
        routeBlockers: this.routePlacements.map((placement) => ({
          id: placement.id,
          x: placement.x,
          y: placement.y,
        })),
      },
    );
  }

  private renderPlacementState(): void {
    this.selectionGraphic.clear();
    this.placementGuideGraphic.clear();
    const selected = this.guardians.find((guardian) => guardian.instanceId === this.selectedPlacedGuardianId);
    if (selected) {
      const color = selected.branch?.color ?? selected.definition.accent;
      this.selectionGraphic.fillStyle(color, 0.06);
      this.selectionGraphic.fillCircle(selected.x, selected.y, selected.range);
      this.selectionGraphic.lineStyle(2, color, 0.8);
      this.selectionGraphic.strokeCircle(selected.x, selected.y, selected.range);
    }

    const placementMode = this.selectedGuardianId ? GUARDIANS[this.selectedGuardianId].placementMode : null;
    if (placementMode === "platform") {
      this.placements.forEach((placement) => {
        this.placementGuideGraphic.lineStyle(2, placement.guardian ? 0xff8290 : 0xa5f6d2, placement.guardian ? 0.42 : 0.72);
        this.placementGuideGraphic.strokeCircle(placement.definition.x, placement.definition.y, 38);
      });
    } else if (placementMode === null) {
      this.placementPreviewGraphic.clear();
      this.placementPreviewText.setVisible(false);
    }
    this.renderDebug();
  }

  // -------------------------------------------------------------- ambiente

  private drawEnvironment(): void {
    const playfieldCenterY = (HUD_TOP + GAME_HEIGHT - HUD_BOTTOM) / 2;
    if (this.level.backgroundKey && this.textures.exists(this.level.backgroundKey)) {
      const levelBackground = this.add
        .image(GAME_WIDTH / 2, playfieldCenterY, this.level.backgroundKey)
        .setDepth(DEPTH.background);
      levelBackground.setScale(GAME_WIDTH / levelBackground.width);
    } else {
      drawLevelBackdrop(this, this.level);
    }

    this.add
      .text(26, 88, `RECIFE ${levelIndex(this.level.id) + 1}  ·  ${this.level.name.toUpperCase()}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        fontStyle: "bold",
        color: "#d9f9ff",
        backgroundColor: "rgba(2, 28, 44, .68)",
        padding: { x: 12, y: 7 },
      })
      .setDepth(DEPTH.effects);
  }

  private createPlacements(): void {
    this.level.placements.forEach((definition) => {
      const zone = this.add.zone(definition.x, definition.y, 94, 94).setDepth(DEPTH.pads + 1);
      zone.setInteractive({ useHandCursor: true });
      const view: PlacementView = { definition, guardian: null, zone };
      zone.on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation();
          this.handlePlacement(view);
        },
      );
      this.placements.push(view);
    });
  }

  private createCurrentMotes(): void {
    this.level.currents.forEach((zone, zoneIndex) => {
      for (let index = 0; index < 14; index += 1) {
        const mote = this.add
          .circle(
            zone.x + ((index * 53) % zone.width),
            zone.y + 12 + ((index * 37) % Math.max(1, zone.height - 24)),
            2 + (index % 3),
            0xa4f5ff,
            0.32,
          )
          .setDepth(DEPTH.current + 1);
        this.currentMotes.push({ mote, zoneIndex });
      }
    });
  }

  private updateCurrentMotes(deltaMs: number): void {
    const sign = this.currentReversed ? -1 : 1;
    this.currentMotes.forEach(({ mote, zoneIndex }, index) => {
      const zone = this.level.currents[zoneIndex];
      const length = Math.hypot(zone.direction.x, zone.direction.y) || 1;
      const speed = 22 + (index % 4) * 8;
      mote.x += sign * (zone.direction.x / length) * speed * (deltaMs / 1000);
      mote.y += sign * (zone.direction.y / length) * speed * (deltaMs / 1000);
      if (mote.x > zone.x + zone.width) mote.x = zone.x;
      if (mote.x < zone.x) mote.x = zone.x + zone.width;
      if (mote.y > zone.y + zone.height) mote.y = zone.y;
      if (mote.y < zone.y) mote.y = zone.y + zone.height;
      mote.setFillStyle(this.currentReversed ? 0xffa080 : 0xa4f5ff, 0.36);
    });
  }

  private shockwave(x: number, y: number, color: number, radius: number): void {
    const circle = this.add.circle(x, y, 10).setStrokeStyle(4, color, 0.9).setDepth(DEPTH.effects);
    this.tweens.add({
      targets: circle,
      radius,
      alpha: 0,
      duration: 260,
      ease: "Quad.Out",
      onComplete: () => circle.destroy(),
    });
  }

  private lightningEffect(guardian: Guardian, targets: readonly Enemy[]): void {
    const graphics = this.add.graphics().setDepth(DEPTH.effects);
    graphics.lineStyle(4, guardian.definition.accent, 0.92);
    let fromX = guardian.x;
    let fromY = guardian.y;
    targets.forEach((target) => {
      graphics.lineBetween(fromX, fromY, target.x, target.y);
      fromX = target.x;
      fromY = target.y;
    });
    this.tweens.add({ targets: graphics, alpha: 0, duration: 170, onComplete: () => graphics.destroy() });
  }

  private inkSplash(guardian: Guardian, target: Enemy): void {
    const graphics = this.add.graphics().setDepth(DEPTH.effects);
    graphics.lineStyle(3, guardian.definition.color, 0.85);
    graphics.lineBetween(guardian.x, guardian.y - 10, target.x, target.y);
    graphics.fillStyle(0x2a1a4a, 0.6);
    graphics.fillCircle(target.x, target.y, 14);
    this.tweens.add({ targets: graphics, alpha: 0, duration: 220, onComplete: () => graphics.destroy() });
  }
}
