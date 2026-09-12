import Phaser from "phaser";
import { artTextureKey, artVariant, GUARDIAN_ART, hasGuardianArt, type AbilityStyle } from "../assets/guardianArt";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { resolveAura, type AuraSource } from "../core/Auras";
import { BlockingSystem } from "../core/Blocking";
import { Economy } from "../core/Economy";
import type { FlowField } from "../core/FlowField";
import {
  flowFieldsFor,
  registerSharkHit,
  updateChorus,
  updateFrenzy,
  updateMark,
  updatePushWave,
  updateSonar,
  updateTrap,
  type BehaviorEvent,
  type BehaviorHooks,
  type DamageOptions as CoreDamageOptions,
} from "../core/GuardianBehaviors";
import type { LevelProgress } from "../core/LevelProgress";
import { PLACEMENT_HINTS, validatePlacement, type PlacementContext } from "../core/PlacementRules";
import { RoutePath } from "../core/RoutePath";
import { WaveScheduler, type WaveSchedulerEvent } from "../core/WaveScheduler";
import { BOSS_CURRENT, ECONOMY, GUARDIAN_BALANCE, PLACEMENT } from "../data/balance";
import { ENEMIES, scaleEnemy } from "../data/enemies";
import { GUARDIANS, resolveLoadout } from "../data/guardians";
import { getLevel, LEVELS, levelIndex, nextLevelId } from "../data/levels";
import { EventBus, Events } from "../EventBus";
import { Enemy } from "../objects/Enemy";
import { Guardian } from "../objects/Guardian";
import { Projectile } from "../objects/Projectile";
import { ArtEffects } from "../systems/ArtEffects";
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
  PoisonEffect,
  ToxicCloudEffect,
  Vec2,
} from "../types";

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
  /** Anel elétrico da tabela de upgrade, quando a arte está carregada. */
  image: Phaser.GameObjects.Image | null;
}

/** Nuvem persistente: tinta do Polvo (slow + vulnerabilidade) ou jardim tóxico do Peixe-Pedra (veneno). */
interface CloudView {
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  durationMs: number;
  expiresAt: number;
  slowFactor: number;
  vulnerabilityMultiplier: number;
  poison: PoisonEffect | null;
  graphic: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image | null;
}

/** Partículas da zona de corrente de uma Tartaruga: fluem em direção contrária à rota. */
interface FlowFieldView {
  ownerId: string;
  ring: Phaser.GameObjects.Graphics;
  motes: Phaser.GameObjects.Arc[];
}

interface DamageOptions extends CoreDamageOptions {
  sound?: boolean;
}

export class GameScene extends Phaser.Scene {
  private level: LevelDefinition = LEVELS[0];
  private progress!: LevelProgress;
  private route!: RoutePath;
  private economy!: Economy;
  private scheduler!: WaveScheduler;
  private audio!: AudioManager;
  private effects!: ArtEffects;
  private debugOverlay!: DebugOverlay;
  private selectionGraphic!: Phaser.GameObjects.Graphics;
  private placementGuideGraphic!: Phaser.GameObjects.Graphics;
  private placementPreviewGraphic!: Phaser.GameObjects.Graphics;
  private placementPreviewText!: Phaser.GameObjects.Text;
  private debugFlags!: DebugFlags;
  private placements: PlacementView[] = [];
  private routePlacements: RoutePlacementView[] = [];
  private electricFields: ElectricFieldView[] = [];
  private clouds: CloudView[] = [];
  private flowViews: FlowFieldView[] = [];
  private flowFields: FlowField[] = [];
  private blocking = new BlockingSystem();
  private enemies: Enemy[] = [];
  private guardians: Guardian[] = [];
  private projectiles: Projectile[] = [];
  private currentMotes: Array<{ mote: Phaser.GameObjects.Arc; zoneIndex: number }> = [];
  private loadout: GuardianId[] = [];
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
    this.clouds = [];
    this.flowViews = [];
    this.flowFields = [];
    this.blocking = new BlockingSystem();
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
    // Esquadrão da partida: `?guardians=shark,dolphin,...` (até a tela de seleção existir).
    this.loadout = resolveLoadout(query.get("guardians"));
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
    this.effects = new ArtEffects(this);
    this.debugFlags = {
      enabled: debugFromQuery,
      route: true,
      ranges: true,
      hitboxes: true,
      current: true,
      states: true,
      targets: true,
      placements: true,
      controls: true,
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
    this.scene.launch("UIScene", { debugFromQuery, loadout: this.loadout });
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

    this.flowFields = flowFieldsFor(this.guardians);
    this.updateFlowVisuals(safeDelta);
    this.updateBlockers(safeDelta);

    for (const enemy of this.enemies) {
      const result = enemy.tick(this.simulationTimeMs, safeDelta, this.level.currents, this.currentReversed, this.flowFields);
      if (result.reachedGoal) {
        this.reefHealth = Math.max(0, this.reefHealth - enemy.definition.reefDamage);
        this.audio.play("warning");
        this.showMessage(`${enemy.definition.name} atingiu o Recife! (-${enemy.definition.reefDamage})`, 1400);
        if (this.reefHealth <= 0) this.finishGame("defeat");
      }
    }
    this.drainPoison();

    const hooks = this.behaviorHooks();
    for (const guardian of this.guardians) updateTrap(guardian, this.enemies, hooks);
    this.updateAuras();
    for (const guardian of this.guardians) {
      updateFrenzy(guardian, this.enemies, this.simulationTimeMs);
      updateMark(guardian, this.enemies, hooks);
      guardian.tick(this.simulationTimeMs, this.enemies, (attacker, target) => this.resolveGuardianAttack(attacker, target));
    }
    for (const guardian of this.guardians) {
      updatePushWave(guardian, this.enemies, hooks);
      updateSonar(guardian, this.enemies, this.guardians, hooks);
    }

    this.updateElectricFields();
    this.updateClouds();

    for (const projectile of this.projectiles) {
      const result = projectile.tick(safeDelta, this.level.currents, this.currentReversed, this.enemies);
      result.hits.forEach((hit) => {
        this.damageEnemy(hit.enemy, hit.damage, { sound: !hit.splash });
        if (!hit.splash) this.effects.burst(projectile.impactKey, hit.enemy.x, hit.enemy.y, { scale: projectile.impactScale });
      });
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

  private placementContext(): PlacementContext {
    return {
      route: this.route,
      platforms: this.placements.map((placement) => placement.definition),
      guardians: this.guardians,
      routeUnits: this.routePlacements,
    };
  }

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
      routePlacement ? { routePlacementId: routePlacement.id, routeDistance: routePlacement.routeDistance } : {},
      this.simulationTimeMs,
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
    if (definition.placementMode === "platform") return;
    const validation = validatePlacement(definition.placementMode, this.placementContext(), { x: pointer.worldX, y: pointer.worldY });
    if (!validation.valid) {
      this.showMessage(validation.reason, 1700);
      this.audio.play("warning");
      return;
    }
    if (definition.placementMode === "route") {
      const placement: RoutePlacementView = {
        id: `rota-${++this.routeSerial}`,
        x: validation.x,
        y: validation.y,
        routeDistance: validation.routeDistance ?? 0,
        progress: validation.progress,
        guardian: null,
      };
      const guardian = this.placeGuardian(definition.id, placement.x, placement.y, placement);
      if (guardian) {
        const verb = guardian.stats.trap ? "enterrado na correnteza!" : guardian.blocks ? "bloqueando a correnteza!" : "de guarda na correnteza!";
        this.showMessage(`${definition.name} ${verb}`, 1500);
      }
      return;
    }
    const guardian = this.placeGuardian(definition.id, validation.x, validation.y);
    if (guardian) {
      this.showMessage(
        definition.placementMode === "margin" ? `${definition.name} à espreita na beira da correnteza.` : `${definition.name} posicionado na água.`,
        1500,
      );
    }
  }

  private handleWorldPointerMove(pointer: Phaser.Input.Pointer): void {
    this.placementPreviewGraphic.clear();
    this.placementPreviewText.setVisible(false);
    if (!this.selectedGuardianId || pointer.y <= HUD_TOP || pointer.y >= GAME_HEIGHT - HUD_BOTTOM) return;
    const definition = GUARDIANS[this.selectedGuardianId];
    if (definition.placementMode === "platform") return;

    const validation = validatePlacement(definition.placementMode, this.placementContext(), { x: pointer.worldX, y: pointer.worldY });
    const label = validation.valid
      ? definition.placementMode === "route"
        ? "Ponto livre da correnteza"
        : definition.placementMode === "margin"
          ? "Beira da correnteza"
          : "Posição válida"
      : validation.reason;

    this.placementPreviewGraphic.fillStyle(validation.valid ? 0x67f2ac : 0xff6f79, 0.2);
    this.placementPreviewGraphic.lineStyle(3, validation.valid ? 0x67f2ac : 0xff6f79, 0.95);
    this.placementPreviewGraphic.fillCircle(validation.x, validation.y, 34);
    this.placementPreviewGraphic.strokeCircle(validation.x, validation.y, 34);
    this.placementPreviewText.setPosition(validation.x, validation.y - 42).setText(label).setVisible(true);
  }

  // -------------------------------------------------------- upgrade e venda

  private upgradeSelectedGuardian(branchId: BranchId): void {
    if (!this.selectedPlacedGuardianId || this.gameOver) return;
    const guardian = this.guardians.find((candidate) => candidate.instanceId === this.selectedPlacedGuardianId);
    if (!guardian) return;
    const option = guardian.options.find((candidate) => candidate.branchId === branchId);
    if (!option) {
      const locked = guardian.branchStatuses.find((status) => status.id === branchId);
      if (locked?.state === "locked") this.showMessage(`Ramo ${locked.name} bloqueado: esta unidade seguiu ${guardian.branch?.name ?? "outro ramo"}.`, 1900);
      return;
    }
    if (!this.economy.canAfford(option.cost)) {
      this.showMessage("Pérolas insuficientes para este upgrade.", 1700);
      this.audio.play("warning");
      return;
    }
    if (!guardian.applyUpgrade(branchId, this.simulationTimeMs)) return;
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
      field.image?.destroy();
      return false;
    });
    this.clouds = this.clouds.filter((cloud) => {
      if (cloud.ownerId !== guardian.instanceId) return true;
      cloud.graphic.destroy();
      cloud.image?.destroy();
      return false;
    });
    this.flowViews = this.flowViews.filter((view) => {
      if (view.ownerId !== guardian.instanceId) return true;
      view.ring.destroy();
      view.motes.forEach((mote) => mote.destroy());
      return false;
    });
    this.blocking.forget(guardian.instanceId);
    this.enemies.forEach((enemy) => {
      if (enemy.blockedById === guardian.instanceId) enemy.clearBlocked();
      if (enemy.status.markedBy(this.simulationTimeMs) === guardian.instanceId) enemy.status.clearMark();
    });
    this.guardians.forEach((other) => {
      if (other.runtime.preferredTarget && guardian.runtime.sonar) other.runtime.preferredTarget = null;
    });
    guardian.destroy();
  }

  // -------------------------------------------------------------- combate

  private resolveGuardianAttack(guardian: Guardian, target: Enemy): void {
    const kind = guardian.definition.attackKind;
    switch (kind) {
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
      case "sonar":
        this.resolveSonarHit(guardian, target);
        return;
      case "area":
        this.resolvePulse(guardian);
        return;
      case "trap":
        return;
      default: {
        const exhaustive: never = kind;
        throw new Error(`attackKind desconhecido: ${String(exhaustive)}`);
      }
    }
  }

  private fireProjectile(guardian: Guardian, target: Enemy): void {
    const originX = guardian.x + 22;
    const originY = guardian.y;
    const shrimpBalance = GUARDIAN_BALANCE["pistol-shrimp"];
    const profile = GUARDIAN_ART[guardian.definition.id];
    const stats = guardian.stats;
    this.projectiles.push(
      new Projectile(
        this,
        originX,
        originY,
        target,
        {
          speed: stats.projectileSpeed,
          damages: stats.pierceDamages,
          predictiveAim: stats.predictiveAim,
          straightRicochet: stats.straightRicochet,
          ricochetRange: shrimpBalance.ricochetRange,
          splash: stats.splash ?? undefined,
          radius: 6,
          lifetimeMs: 2200,
          bounds: { minX: -80, maxX: GAME_WIDTH + 80, minY: -80, maxY: GAME_HEIGHT + 80 },
        },
        {
          textureKey: guardian.artTexture("projectile"),
          scale: profile.effectScale,
          impactKey: guardian.artTexture("impact"),
          impactScale: profile.effectScale * 0.9,
        },
      ),
    );
    this.audio.play("shot");
    this.shockwave(originX, originY, guardian.definition.accent, 34);
  }

  private resolveChain(guardian: Guardian, target: Enemy): void {
    const stats = guardian.stats;
    const damages = stats.chainDamages;
    const candidates = this.enemies
      .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= guardian.range)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, damages.length);
    const slowFactor = stats.slowFactor;
    candidates.forEach((enemy, index) => {
      this.damageEnemy(enemy, damages[index] ?? damages[damages.length - 1], { sourceId: guardian.instanceId });
      if (slowFactor !== null) enemy.applySlow(slowFactor, stats.slowDurationMs, this.simulationTimeMs);
    });
    const stun = stats.stun;
    if (stun && !target.dead) {
      if (target.tryStun(stun.durationMs, stun.immunityMs, this.simulationTimeMs)) {
        this.shockwave(target.x, target.y, 0xfff27a, 26);
      }
    }
    this.chainEffect(guardian, candidates);
    if (stats.electricField) this.createElectricField(guardian, target.x, target.y);
    this.audio.play("zap");
  }

  private resolvePulse(guardian: Guardian): void {
    const stats = guardian.stats;
    const slowFactor = stats.slowFactor;
    const affected = this.enemies.filter(
      (enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= guardian.range,
    );
    affected.forEach((enemy) => {
      this.damageEnemy(enemy, stats.damage, { sourceId: guardian.instanceId });
      if (slowFactor !== null) enemy.applySlow(slowFactor, stats.slowDurationMs, this.simulationTimeMs);
    });
    this.effects.ring(this.abilityKeyFor(guardian, "ring"), guardian.x, guardian.y + 8, guardian.range * 2);
    affected.slice(0, 4).forEach((enemy) => this.impactBurst(guardian, enemy.x, enemy.y, 0.7));
    this.shockwave(guardian.x, guardian.y, guardian.definition.accent, guardian.range);
    this.audio.play("pulse");
  }

  private resolveMelee(guardian: Guardian, target: Enemy): void {
    const stats = guardian.stats;
    const spin = stats.spin;
    const spinning = spin !== null && guardian.attacksPerformed % spin.everyAttacks === 0;
    const radius = spinning && spin ? guardian.range * spin.radiusMultiplier : guardian.range;
    const damage = spinning && spin ? spin.damage : stats.damage;
    const targets = stats.areaAttack || spinning
      ? this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= radius)
      : [target];
    const vulnerability = stats.vulnerability;
    if (stats.mark) registerSharkHit(guardian, target, this.simulationTimeMs);
    targets.forEach((enemy) => {
      this.damageEnemy(enemy, damage, { armorPiercing: stats.armorPiercing, sourceId: guardian.instanceId });
      if (vulnerability) enemy.applyVulnerability(vulnerability.multiplier, vulnerability.durationMs, this.simulationTimeMs);
      if (stats.slowFactor !== null) enemy.applySlow(stats.slowFactor, stats.slowDurationMs, this.simulationTimeMs);
    });
    if (stats.areaAttack || spinning) {
      this.effects.ring(this.abilityKeyFor(guardian, "ring"), guardian.x, guardian.y + 8, radius * 2, { spin: spinning });
    } else {
      const profile = GUARDIAN_ART[guardian.definition.id];
      this.effects.burst(this.abilityKeyFor(guardian, "burst"), target.x, target.y, {
        scale: profile.effectScale,
        rotation: Math.atan2(target.y - guardian.y, target.x - guardian.x),
      });
    }
    if (stats.dash) this.dashTrail(guardian, target);
    targets.slice(0, 4).forEach((enemy) => this.impactBurst(guardian, enemy.x, enemy.y, enemy === target ? 1 : 0.7));
    this.shockwave(guardian.x, guardian.y, guardian.definition.accent, spinning ? radius : 30);
    this.audio.play(spinning ? "pulse" : "impact");
  }

  private resolveInk(guardian: Guardian, target: Enemy): void {
    const stats = guardian.stats;
    const vulnerability = stats.vulnerability;
    const affected = vulnerability?.radius
      ? this.enemies.filter(
          (enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(target.x, target.y) <= (vulnerability.radius ?? 0),
        )
      : [target];
    if (!affected.includes(target)) affected.push(target);
    affected.forEach((enemy) => {
      this.damageEnemy(enemy, enemy === target ? stats.damage : Math.ceil(stats.damage * 0.5), {
        sound: enemy === target,
        sourceId: guardian.instanceId,
      });
      if (vulnerability) enemy.applyVulnerability(vulnerability.multiplier, vulnerability.durationMs, this.simulationTimeMs);
    });
    const jet = this.effects.beam(this.abilityKeyFor(guardian, "beam"), guardian.x + 14, guardian.y - 6, target.x, target.y, 0.5);
    if (!jet) this.inkSplash(guardian, target);
    // Ramo Maré Aliada: o desenho da habilidade é a onda de buff, exibida como pulso no próprio Polvo.
    if (artVariant(guardian.definition.id, guardian.progress).ability === "ring" && !stats.inkCloud) {
      this.effects.ring(this.abilityKeyFor(guardian, "ring"), guardian.x, guardian.y + 8, guardian.range * 2, { alpha: 0.6 });
    }
    this.impactBurst(guardian, target.x, target.y);
    if (stats.inkCloud) this.createInkCloud(guardian, target.x, target.y);
    this.audio.play("zap");
  }

  /** Golpe base do Golfinho: pulso sonoro fraco em um alvo (o sonar de área é a habilidade periódica). */
  private resolveSonarHit(guardian: Guardian, target: Enemy): void {
    this.damageEnemy(target, guardian.stats.damage, { sourceId: guardian.instanceId });
    const beam = this.effects.beam(this.abilityKeyFor(guardian, "beam"), guardian.x + 12, guardian.y - 4, target.x, target.y, 0.4);
    if (!beam) {
      const graphics = this.add.graphics().setDepth(DEPTH.effects);
      graphics.lineStyle(2, guardian.definition.accent, 0.8);
      graphics.lineBetween(guardian.x, guardian.y - 6, target.x, target.y);
      graphics.lineStyle(1, guardian.definition.accent, 0.5);
      graphics.strokeCircle(target.x, target.y, 10);
      this.tweens.add({ targets: graphics, alpha: 0, duration: 200, onComplete: () => graphics.destroy() });
    }
    this.impactBurst(guardian, target.x, target.y, 0.7);
    this.audio.play("zap");
  }

  /**
   * Imagem "Habilidade" da variante atual quando ela é exibida no estilo pedido; senão, a do primeiro
   * nível abaixo que seja (por exemplo, o raio do Elétrico I serve à descarga do Elétrico II, cujo
   * desenho é o anel do Campo Elétrico).
   */
  private abilityKeyFor(guardian: Guardian, style: AbilityStyle): string | null {
    for (let level = guardian.upgradeLevel; level >= 0; level -= 1) {
      const variant = artVariant(guardian.definition.id, { branchId: guardian.branchId, upgradeLevel: level });
      if (variant.ability === style) return artTextureKey(guardian.definition.id, variant, "projectile");
    }
    return null;
  }

  private impactBurst(guardian: Guardian, x: number, y: number, factor = 1): void {
    const profile = GUARDIAN_ART[guardian.definition.id];
    this.effects.burst(guardian.artTexture("impact"), x, y, { scale: profile.effectScale * 0.9 * factor });
  }

  /** Descarga da Água-viva: raio esticado até cada alvo em sequência, ou espiral sobre os alvos. */
  private chainEffect(guardian: Guardian, targets: readonly Enemy[]): void {
    const beamKey = this.abilityKeyFor(guardian, "beam");
    const burstKey = this.abilityKeyFor(guardian, "burst");
    let drawn = false;
    if (targets.length > 0 && this.effects.has(beamKey)) {
      let fromX = guardian.x;
      let fromY = guardian.y - 10;
      targets.forEach((target, index) => {
        this.effects.beam(beamKey, fromX, fromY, target.x, target.y, index === 0 ? 0.55 : 0.4);
        fromX = target.x;
        fromY = target.y;
      });
      drawn = true;
    } else if (this.effects.has(burstKey)) {
      const profile = GUARDIAN_ART[guardian.definition.id];
      targets.forEach((target, index) => {
        this.effects.burst(burstKey, target.x, target.y, { scale: profile.effectScale * (index === 0 ? 1 : 0.7), spin: true });
      });
      drawn = targets.length > 0;
    }
    if (!drawn) this.lightningEffect(guardian, targets);
    targets.forEach((target, index) => this.impactBurst(guardian, target.x, target.y, index === 0 ? 1 : 0.7));
  }

  private damageEnemy(enemy: Enemy, damage: number, options: DamageOptions = {}): void {
    const killed = options.continuous
      ? enemy.takeContinuousDamage(damage, options)
      : enemy.takeDamage(damage, { armorPiercing: options.armorPiercing, sourceId: options.sourceId });
    if (options.sound ?? true) this.audio.play("impact");
    if (killed) {
      this.economy.earn(enemy.definition.reward);
      if (enemy.definition.isBoss) {
        this.currentReversed = false;
        this.showMessage(`${enemy.definition.name} caiu! A corrente se estabilizou.`, 2400);
      }
    }
  }

  private drainPoison(): void {
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.reachedGoal) continue;
      const owed = enemy.status.drainPoison(this.simulationTimeMs);
      if (owed > 0) {
        this.damageEnemy(enemy, owed, { continuous: true, sound: false });
        this.poisonPuff(enemy.x, enemy.y);
      }
    }
  }

  private behaviorHooks(): BehaviorHooks<Enemy> {
    return {
      now: this.simulationTimeMs,
      damage: (enemy, amount, options) => this.damageEnemy(enemy, amount, { ...options, sound: false }),
      spawnCloud: (ownerId, x, y, cloud) => this.createToxicCloud(ownerId, x, y, cloud),
      onEscaped: (blockerId, enemyId) => {
        const blocker = this.guardians.find((guardian) => guardian.instanceId === blockerId);
        this.blocking.notifyEscaped(blockerId, enemyId, this.simulationTimeMs, blocker?.stats.blockHold?.releaseCooldownMs ?? 500);
      },
      emit: (event) => this.handleBehaviorEvent(event),
    };
  }

  /** Visual e áudio dos comportamentos compartilhados (a simulação ignora estes eventos). */
  private handleBehaviorEvent(event: BehaviorEvent): void {
    const guardian = "guardianId" in event ? this.guardians.find((candidate) => candidate.instanceId === event.guardianId) : undefined;
    switch (event.type) {
      case "trapPhase":
        guardian?.setTrapPhase(event.phase);
        if (event.phase === "armed" && guardian) this.shockwave(guardian.x, guardian.y, 0xffd166, 22);
        return;
      case "trapTrigger": {
        if (!guardian) return;
        const key = this.abilityKeyFor(guardian, "ring");
        if (!this.effects.ring(key, event.x, event.y + 6, event.radius * 2.4, { durationMs: 420 })) {
          const graphics = this.add.graphics().setDepth(DEPTH.effects);
          graphics.fillStyle(0xd9b36b, 0.55);
          graphics.fillCircle(event.x, event.y, event.radius);
          graphics.lineStyle(3, 0xffd166, 0.9);
          graphics.strokeCircle(event.x, event.y, event.radius);
          this.tweens.add({ targets: graphics, alpha: 0, scale: 1.3, duration: 380, onComplete: () => graphics.destroy() });
        }
        event.targetIds.forEach((id) => {
          const enemy = this.enemies.find((candidate) => candidate.instanceId === id);
          if (enemy) this.impactBurst(guardian, enemy.x, enemy.y, 0.8);
        });
        this.shockwave(event.x, event.y, 0xffd166, event.radius * 1.4);
        this.audio.play("pulse");
        return;
      }
      case "mark": {
        const enemy = this.enemies.find((candidate) => candidate.instanceId === event.enemyId);
        if (enemy) this.shockwave(enemy.x, enemy.y, 0xff4d5e, 30);
        return;
      }
      case "pushWave": {
        if (!guardian) return;
        const key = this.abilityKeyFor(guardian, "ring");
        this.effects.ring(key, event.x, event.y + 6, event.radius * 2, { durationMs: event.visualMs, alpha: 0.8 });
        const surge = this.add.circle(event.x, event.y, event.radius * 0.4).setStrokeStyle(4, 0x6fe3ff, 0.85).setDepth(DEPTH.effects);
        this.tweens.add({
          targets: surge,
          radius: event.radius,
          alpha: 0,
          duration: event.visualMs,
          ease: "Quad.Out",
          onComplete: () => surge.destroy(),
        });
        event.pushedIds.forEach((id) => {
          const enemy = this.enemies.find((candidate) => candidate.instanceId === id);
          if (enemy) this.shockwave(enemy.x, enemy.y, 0x9fefff, 18);
        });
        this.audio.play("pulse");
        return;
      }
      case "sonarWave": {
        const color = event.wave.coordinate ? 0x9b7bff : event.wave.vulnerability ? 0xb59cff : 0x6fd6ff;
        const circle = this.add.circle(event.x, event.y, 12).setStrokeStyle(3, color, 0.85).setDepth(DEPTH.effects);
        this.tweens.add({
          targets: circle,
          radius: event.radius,
          alpha: 0,
          duration: 520,
          ease: "Sine.Out",
          onComplete: () => circle.destroy(),
        });
        if (guardian) this.effects.ring(this.abilityKeyFor(guardian, "ring"), event.x, event.y + 6, event.radius * 2, { alpha: 0.45, durationMs: 520 });
        if (event.wave.index === 0) this.audio.play("zap");
        return;
      }
      case "coordinate": {
        const target = this.enemies.find((candidate) => candidate.instanceId === event.targetId);
        if (target) this.shockwave(target.x, target.y, 0x9b7bff, 44);
        if (guardian) this.showMessage(`${guardian.definition.name} coordena o cardume contra ${target?.definition.name ?? "a ameaça"}!`, 1500);
        return;
      }
      case "chorusStart": {
        if (!guardian) return;
        this.effects.ring(this.abilityKeyFor(guardian, "ring"), guardian.x, guardian.y + 6, event.radius * 2, { alpha: 0.7, durationMs: 600 });
        const notes = this.add.graphics().setDepth(DEPTH.effects);
        notes.lineStyle(3, 0xffd76a, 0.9);
        notes.strokeCircle(guardian.x, guardian.y, 20);
        notes.strokeCircle(guardian.x, guardian.y, 36);
        this.tweens.add({ targets: notes, alpha: 0, duration: event.durationMs * 0.4, onComplete: () => notes.destroy() });
        this.audio.play("upgrade");
        return;
      }
      case "stunned": {
        const enemy = this.enemies.find((candidate) => candidate.instanceId === event.enemyId);
        if (enemy) this.shockwave(enemy.x, enemy.y, 0xfff27a, 26);
        return;
      }
      case "poisoned":
        return;
    }
  }

  private updateBlockers(deltaMs: number): void {
    this.blocking.update(this.guardians, this.enemies, this.simulationTimeMs, deltaMs, {
      damage: (enemy, amount) => this.damageEnemy(enemy, amount, { sound: false, continuous: true }),
      onBossHeld: (blocker, enemy) => {
        this.showMessage(`${blocker.definition.name} segurou ${enemy.definition.name} por um instante!`, 1500);
        this.shockwave(enemy.x, enemy.y, 0xffe082, 50);
      },
      onReleased: (_blocker, enemy) => this.shockwave(enemy.x, enemy.y, 0x8cd98a, 20),
    });
  }

  private updateAuras(): void {
    const sources: AuraSource[] = [];
    for (const guardian of this.guardians) {
      const provided = guardian.providedAura;
      if (provided) sources.push({ id: guardian.instanceId, x: guardian.x, y: guardian.y, range: guardian.range, aura: provided });
      const chorus = updateChorus(guardian, this.guardians, this.simulationTimeMs, (event) => this.handleBehaviorEvent(event));
      if (chorus) sources.push(chorus);
    }
    this.guardians.forEach((guardian) => {
      guardian.setAura(resolveAura({ id: guardian.instanceId, guardianId: guardian.definition.id, x: guardian.x, y: guardian.y }, sources));
    });
  }

  private createElectricField(guardian: Guardian, x: number, y: number): void {
    const definition = guardian.stats.electricField;
    if (!definition) return;
    if (!guardian.runtime.cooldown("electricField").tryActivate(this.simulationTimeMs, definition.cooldownMs * guardian.stats.abilityCooldownMultiplier)) return;
    this.electricFields = this.electricFields.filter((field) => {
      if (field.ownerId !== guardian.instanceId) return true;
      field.graphic.destroy();
      field.image?.destroy();
      return false;
    });
    const image = this.effects.persistent(this.abilityKeyFor(guardian, "ring"), x, y, definition.radius * 2);
    const graphic = this.add.graphics().setDepth(DEPTH.effects - 1);
    graphic.fillStyle(0x9e65ff, image ? 0.08 : 0.13);
    graphic.fillCircle(x, y, definition.radius);
    graphic.lineStyle(3, 0x7deaff, image ? 0.35 : 0.72);
    graphic.strokeCircle(x, y, definition.radius);
    if (!image) {
      graphic.lineStyle(1, 0xe5d3ff, 0.65);
      graphic.strokeCircle(x, y, definition.radius * 0.58);
    }
    this.electricFields.push({
      image,
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
        field.image?.destroy();
        return false;
      }
      const remaining = (field.expiresAt - this.simulationTimeMs) / field.durationMs;
      field.graphic.setAlpha(Math.max(0.18, Math.min(1, remaining)));
      field.image?.setAlpha(Math.max(0.2, Math.min(0.85, remaining)));
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
    const definition = guardian.stats.inkCloud;
    if (!definition) return;
    if (!guardian.runtime.cooldown("inkCloud").tryActivate(this.simulationTimeMs, definition.cooldownMs * guardian.stats.abilityCooldownMultiplier)) return;
    const image = this.effects.persistent(this.abilityKeyFor(guardian, "ring"), x, y, definition.radius * 2);
    const graphic = this.add.graphics().setDepth(DEPTH.effects - 1);
    graphic.fillStyle(0x2a1a4a, image ? 0.2 : 0.45);
    graphic.fillCircle(x, y, definition.radius);
    if (!image) {
      graphic.fillStyle(0x6b5bd6, 0.25);
      graphic.fillCircle(x - definition.radius * 0.25, y - definition.radius * 0.2, definition.radius * 0.6);
    }
    graphic.lineStyle(2, 0xd58cff, image ? 0.35 : 0.6);
    graphic.strokeCircle(x, y, definition.radius);
    this.replaceCloud({
      image,
      ownerId: guardian.instanceId,
      x,
      y,
      radius: definition.radius,
      durationMs: definition.durationMs,
      expiresAt: this.simulationTimeMs + definition.durationMs,
      slowFactor: definition.slowFactor,
      vulnerabilityMultiplier: definition.vulnerabilityMultiplier,
      poison: null,
      graphic,
    });
  }

  /** Jardim Tóxico do Peixe-Pedra: nuvem verde que envenena quem passa. */
  private createToxicCloud(ownerId: string, x: number, y: number, cloud: ToxicCloudEffect): void {
    const owner = this.guardians.find((guardian) => guardian.instanceId === ownerId);
    const image = owner ? this.effects.persistent(this.abilityKeyFor(owner, "ring"), x, y, cloud.radius * 2) : null;
    const graphic = this.add.graphics().setDepth(DEPTH.effects - 1);
    graphic.fillStyle(0x4f8a2f, image ? 0.18 : 0.4);
    graphic.fillCircle(x, y, cloud.radius);
    graphic.fillStyle(0x8ef26b, 0.2);
    graphic.fillCircle(x + cloud.radius * 0.2, y - cloud.radius * 0.25, cloud.radius * 0.55);
    graphic.lineStyle(2, 0xa4f26b, 0.6);
    graphic.strokeCircle(x, y, cloud.radius);
    this.replaceCloud({
      image,
      ownerId,
      x,
      y,
      radius: cloud.radius,
      durationMs: cloud.durationMs,
      expiresAt: this.simulationTimeMs + cloud.durationMs,
      slowFactor: 1,
      vulnerabilityMultiplier: 1,
      poison: cloud.poison,
      graphic,
    });
  }

  private replaceCloud(cloud: CloudView): void {
    this.clouds = this.clouds.filter((existing) => {
      if (existing.ownerId !== cloud.ownerId) return true;
      existing.graphic.destroy();
      existing.image?.destroy();
      return false;
    });
    this.clouds.push(cloud);
  }

  private updateClouds(): void {
    this.clouds = this.clouds.filter((cloud) => {
      if (this.simulationTimeMs >= cloud.expiresAt) {
        cloud.graphic.destroy();
        cloud.image?.destroy();
        return false;
      }
      const remaining = (cloud.expiresAt - this.simulationTimeMs) / cloud.durationMs;
      cloud.graphic.setAlpha(Math.max(0.25, Math.min(1, remaining + 0.2)));
      cloud.image?.setAlpha(Math.max(0.25, Math.min(0.85, remaining + 0.15)));
      this.enemies
        .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(cloud.x, cloud.y) <= cloud.radius)
        .forEach((enemy) => {
          if (cloud.slowFactor < 1) enemy.applySlow(cloud.slowFactor, 320, this.simulationTimeMs);
          if (cloud.vulnerabilityMultiplier > 1) enemy.applyVulnerability(cloud.vulnerabilityMultiplier, 320, this.simulationTimeMs);
          if (cloud.poison && !enemy.status.isPoisoned(this.simulationTimeMs)) enemy.status.applyPoison(cloud.poison, this.simulationTimeMs);
        });
      return true;
    });
  }

  /** Zonas de corrente da Tartaruga: anel na água e partículas fluindo contra a rota. */
  private updateFlowVisuals(deltaMs: number): void {
    const active = new Set(this.flowFields.map((field) => field.ownerId));
    this.flowViews = this.flowViews.filter((view) => {
      if (active.has(view.ownerId)) return true;
      view.ring.destroy();
      view.motes.forEach((mote) => mote.destroy());
      return false;
    });
    for (const field of this.flowFields) {
      let view = this.flowViews.find((candidate) => candidate.ownerId === field.ownerId);
      if (!view) {
        const ring = this.add.graphics().setDepth(DEPTH.current + 1);
        const motes: Phaser.GameObjects.Arc[] = [];
        for (let index = 0; index < 12; index += 1) {
          const angle = (Math.PI * 2 * index) / 12;
          const distance = field.radius * (0.35 + ((index * 37) % 60) / 100);
          motes.push(
            this.add
              .circle(field.x + Math.cos(angle) * distance, field.y + Math.sin(angle) * distance, 2 + (index % 3), 0x9fefff, 0.45)
              .setDepth(DEPTH.current + 2),
          );
        }
        view = { ownerId: field.ownerId, ring, motes };
        this.flowViews.push(view);
      }
      view.ring.clear();
      view.ring.fillStyle(0x4fd6ff, field.speedFactor < 0.85 ? 0.08 : 0.05);
      view.ring.fillCircle(field.x, field.y, field.radius);
      view.ring.lineStyle(2, 0x6fe3ff, 0.45);
      view.ring.strokeCircle(field.x, field.y, field.radius);
      // Partículas correm contra o sentido da rota no ponto onde estão: a água "empurra de volta".
      view.motes.forEach((mote, index) => {
        const tangent = this.route.getTangentAtDistance(this.route.getClosestPoint(mote).routeDistance);
        const speed = (30 + (index % 4) * 10) * (1.2 - field.speedFactor);
        mote.x -= tangent.x * speed * (deltaMs / 1000);
        mote.y -= tangent.y * speed * (deltaMs / 1000);
        if (Math.hypot(mote.x - field.x, mote.y - field.y) > field.radius) {
          const angle = Math.atan2(mote.y - field.y, mote.x - field.x) + Math.PI + (index % 5) * 0.2;
          mote.x = field.x + Math.cos(angle) * field.radius * 0.9;
          mote.y = field.y + Math.sin(angle) * field.radius * 0.9;
        }
      });
    }
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
      loadout: [...this.loadout],
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
            artVariant: selected.artVariantFolder,
            options: selected.options,
            branches: selected.branchStatuses,
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
    dataset.selectedVariant = selected?.artVariantFolder ?? "";
    dataset.sellValue = selected ? String(selected.sellValueAt(ECONOMY.sellRefundRate)) : "";
    dataset.loadout = this.loadout.join(",");
    dataset.debug = String(this.debugFlags.enabled);
    dataset.paused = String(this.paused);
    const shrimp = this.guardians.find((guardian) => guardian.definition.id === "pistol-shrimp");
    dataset.shrimpAssets = String(hasGuardianArt(this, "pistol-shrimp"));
    dataset.shrimpArt = String(shrimp?.usesSpriteArt ?? false);
    dataset.shrimpVisual = shrimp?.currentVisualKey ?? "";
    dataset.shrimpTexture = shrimp?.currentTextureKey ?? "";
    dataset.projectileTexture = this.projectiles.at(-1)?.textureKey ?? "";
    const boss = this.enemies.find((enemy) => enemy.definition.isBoss && !enemy.dead && !enemy.reachedGoal);
    dataset.boss = boss
      ? `${boss.x.toFixed(0)},${boss.y.toFixed(0)},${boss.effectiveSpeed.toFixed(1)},${Math.ceil(boss.health)},${boss.blockedById ?? "-"}`
      : "";
    dataset.enemies = String(this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedGoal).length);
    const trap = this.guardians.find((guardian) => guardian.currentTrapPhase !== null);
    dataset.trapPhase = trap?.currentTrapPhase ?? "";
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
        waterRouteClearance: PLACEMENT.waterRouteClearance,
        waterSeparation: PLACEMENT.separation,
        routePlacementClearance: PLACEMENT.routeClearance,
        marginBand: { min: PLACEMENT.marginMin, max: PLACEMENT.marginMax },
        platforms: this.placements.map((placement) => ({
          x: placement.definition.x,
          y: placement.definition.y,
        })),
        routeBlockers: this.routePlacements.map((placement) => ({
          id: placement.id,
          x: placement.x,
          y: placement.y,
          label: placement.guardian?.definition.shortName.toUpperCase() ?? "ROTA",
        })),
      },
      { flowFields: this.flowFields, now: this.simulationTimeMs },
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
    } else if (placementMode === "margin") {
      // Faixa da margem: duas linhas paralelas à rota mostram onde o Tubarão pode ficar.
      this.placementGuideGraphic.lineStyle(PLACEMENT.marginMax * 2, 0x67f2ac, 0.06);
      this.strokeRoute(this.placementGuideGraphic);
      this.placementGuideGraphic.lineStyle(PLACEMENT.marginMin * 2, 0x031d2d, 0.12);
      this.strokeRoute(this.placementGuideGraphic);
    } else if (placementMode === null) {
      this.placementPreviewGraphic.clear();
      this.placementPreviewText.setVisible(false);
    }
    this.renderDebug();
  }

  private strokeRoute(graphics: Phaser.GameObjects.Graphics): void {
    graphics.beginPath();
    this.level.waypoints.forEach((point, index) => {
      if (index === 0) graphics.moveTo(point.x, point.y);
      else graphics.lineTo(point.x, point.y);
    });
    graphics.strokePath();
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

  /** Rastro da investida do Tubarão: afterimages entre a margem e o alvo (mais vermelhas no Frenesi). */
  private dashTrail(guardian: Guardian, target: Enemy): void {
    const frenzy = guardian.stats.frenzy !== null;
    const color = frenzy ? 0xff4d5e : 0x9fc9ff;
    const steps = frenzy ? 4 : 2;
    for (let index = 1; index <= steps; index += 1) {
      const t = index / (steps + 1);
      const x = guardian.x + (target.x - guardian.x) * t;
      const y = guardian.y + (target.y - guardian.y) * t;
      const ghost = this.add.ellipse(x, y, 40, 14, color, 0.28 - index * 0.04).setDepth(DEPTH.effects - 1);
      ghost.setRotation(Math.atan2(target.y - guardian.y, target.x - guardian.x));
      this.tweens.add({ targets: ghost, alpha: 0, scaleX: 0.6, duration: 260 + index * 40, onComplete: () => ghost.destroy() });
    }
  }

  private poisonPuff(x: number, y: number): void {
    const puff = this.add.circle(x + 6, y - 10, 4, 0x8ef26b, 0.7).setDepth(DEPTH.effects);
    this.tweens.add({ targets: puff, y: y - 26, alpha: 0, duration: 420, onComplete: () => puff.destroy() });
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
