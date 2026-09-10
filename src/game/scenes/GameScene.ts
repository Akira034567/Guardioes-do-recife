import Phaser from "phaser";
import { RECIFE_ONE_BACKGROUND_KEY, SHRIMP_LEVEL_TEXTURES } from "../assets/recifeOneAssets";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import { AbilityCooldown } from "../core/AbilityCooldown";
import { hasReachedBlockerContact } from "../core/Combat";
import { Economy } from "../core/Economy";
import { RoutePath } from "../core/RoutePath";
import { WaveScheduler, type WaveSchedulerEvent } from "../core/WaveScheduler";
import { ENEMIES } from "../data/enemies";
import { GUARDIANS } from "../data/guardians";
import { RECIFE_ONE } from "../data/recifeOne";
import { EventBus, Events } from "../EventBus";
import { Enemy } from "../objects/Enemy";
import { Guardian } from "../objects/Guardian";
import { Projectile } from "../objects/Projectile";
import { AudioManager } from "../systems/AudioManager";
import { DebugOverlay } from "../systems/DebugOverlay";
import type { DebugFlags, GuardianId, HudSnapshot, PlacementDefinition, Vec2 } from "../types";

const ROUTE_PLACEMENT_CLEARANCE = 52;
const ROUTE_BLOCKER_SEPARATION = 78;

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
  slowFactor: number;
  slowDurationMs: number;
  graphic: Phaser.GameObjects.Graphics;
}

export class GameScene extends Phaser.Scene {
  private readonly level = RECIFE_ONE;
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
  private electricFieldCooldowns = new Map<string, AbilityCooldown>();
  private enemies: Enemy[] = [];
  private guardians: Guardian[] = [];
  private projectiles: Projectile[] = [];
  private currentMotes: Phaser.GameObjects.Arc[] = [];
  private selectedGuardianId: GuardianId | null = null;
  private selectedPlacedGuardianId: string | null = null;
  private reefHealth = this.level.reefHealth;
  private gameOver: "victory" | "defeat" | null = null;
  private paused = false;
  private currentReversed = false;
  private bossCycleMs = 0;
  private bossReverseRemainingMs = 0;
  private simulationTimeMs = 0;
  private enemySerial = 0;
  private guardianSerial = 0;
  private message = "Escolha um Guardião e toque em uma plataforma.";
  private messageUntilMs = 5_000;
  private hudAccumulatorMs = 0;
  private debugAccumulatorMs = 0;
  private readonly unlockAudio = (): void => this.audio?.unlock();

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.enemies = [];
    this.guardians = [];
    this.projectiles = [];
    this.currentMotes = [];
    this.placements = [];
    this.routePlacements = [];
    this.electricFields = [];
    this.electricFieldCooldowns = new Map();
    this.selectedGuardianId = null;
    this.selectedPlacedGuardianId = null;
    this.reefHealth = this.level.reefHealth;
    this.gameOver = null;
    this.paused = false;
    this.currentReversed = false;
    this.bossCycleMs = 0;
    this.bossReverseRemainingMs = 0;
    this.simulationTimeMs = 0;
    this.enemySerial = 0;
    this.guardianSerial = 0;
    this.message = "Escolha um Guardião e toque em uma plataforma.";
    this.messageUntilMs = 5_000;
    this.hudAccumulatorMs = 0;
    this.debugAccumulatorMs = 0;
    this.route = new RoutePath(this.level.waypoints);
    this.economy = new Economy(this.level.startingPearls);
    this.scheduler = new WaveScheduler(
      this.level.waves,
      this.level.initialWaveDelayMs,
      this.level.betweenWaveDelayMs,
    );
    this.audio = new AudioManager();
    const debugFromQuery = new URLSearchParams(window.location.search).get("debug") === "1";
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
        this.showMessage(`O ${enemy.definition.name} atingiu o Recife!`, 1400);
        if (this.reefHealth <= 0) this.finishGame("defeat");
      }
    }

    for (const guardian of this.guardians) {
      guardian.tick(this.simulationTimeMs, this.enemies, (attacker, target) => this.resolveGuardianAttack(attacker, target));
    }

    this.updateElectricFields();

    for (const projectile of this.projectiles) {
      const result = projectile.tick(safeDelta, this.level.currents, this.currentReversed, this.enemies);
      result.hits.forEach((hit) => this.damageEnemy(hit.enemy, hit.damage));
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

  private registerEvents(): void {
    EventBus.on(Events.selectGuardian, this.selectGuardian, this);
    EventBus.on(Events.upgradeGuardian, this.upgradeSelectedGuardian, this);
    EventBus.on(Events.togglePause, this.togglePause, this);
    EventBus.on(Events.toggleMute, this.toggleMute, this);
    EventBus.on(Events.restart, this.restartGame, this);
    EventBus.on(Events.skipCountdown, this.skipCountdown, this);
    EventBus.on(Events.toggleDebug, this.toggleDebug, this);
    EventBus.on(Events.toggleDebugFlag, this.toggleDebugFlag, this);
    this.input.on("pointermove", this.handleWorldPointerMove, this);
    this.input.on("pointerdown", this.handleWorldPointerDown, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(Events.selectGuardian, this.selectGuardian, this);
      EventBus.off(Events.upgradeGuardian, this.upgradeSelectedGuardian, this);
      EventBus.off(Events.togglePause, this.togglePause, this);
      EventBus.off(Events.toggleMute, this.toggleMute, this);
      EventBus.off(Events.restart, this.restartGame, this);
      EventBus.off(Events.skipCountdown, this.skipCountdown, this);
      EventBus.off(Events.toggleDebug, this.toggleDebug, this);
      EventBus.off(Events.toggleDebugFlag, this.toggleDebugFlag, this);
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
      const hint = definition.placementMode === "platform"
        ? "uma plataforma"
        : definition.placementMode === "water"
          ? "uma área livre da água"
          : "qualquer ponto da correnteza";
      this.showMessage(`Toque em ${hint} para posicionar ${definition.name}.`, 2200);
    }
    this.emitHud();
    this.renderPlacementState();
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
        this.selectedPlacedGuardianId = null;
        this.emitHud();
        this.renderPlacementState();
        return;
      }
      this.showMessage("Escolha primeiro um Guardião no painel inferior.", 1800);
      return;
    }

    const definition = GUARDIANS[this.selectedGuardianId];
    if (definition.placementMode !== "platform") {
      this.showMessage(
        definition.placementMode === "water"
          ? "A Água-viva deve flutuar livremente na água, longe da rota."
          : "O Baiacu pode ocupar qualquer ponto livre da correnteza.",
        1900,
      );
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
    this.showMessage(`${guardian.definition.name} · nível ${guardian.upgradeLevel}/2`, 1400);
    this.emitHud();
    this.renderPlacementState();
  }

  private handleWorldPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameOver || pointer.y <= HUD_TOP || pointer.y >= GAME_HEIGHT - HUD_BOTTOM) return;
    if (!this.selectedGuardianId) {
      if (this.selectedPlacedGuardianId) {
        this.selectedPlacedGuardianId = null;
        this.emitHud();
        this.renderPlacementState();
      }
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
      if (guardian) this.showMessage("Água-viva posicionada na água.", 1500);
    } else if (definition.placementMode === "route") {
      const validation = this.validateRoutePlacement(pointer.worldX, pointer.worldY);
      if (!validation.valid) {
        this.showMessage(validation.reason, 1700);
        this.audio.play("warning");
        return;
      }
      const placement: RoutePlacementView = {
        id: `bloqueio-livre-${this.routePlacements.length + 1}`,
        x: validation.x,
        y: validation.y,
        routeDistance: validation.routeDistance,
        progress: validation.progress,
        guardian: null,
      };
      const guardian = this.placeGuardian(definition.id, placement.x, placement.y, placement);
      if (guardian) this.showMessage("Baiacu bloqueando a correnteza!", 1500);
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
    if (this.route.getClosestPoint({ x, y }).distance < 82) {
      return { valid: false, reason: "Muito perto da rota" };
    }
    if (this.placements.some((placement) => Math.hypot(x - placement.definition.x, y - placement.definition.y) < 78)) {
      return { valid: false, reason: "Plataforma ocupa este espaço" };
    }
    if (this.guardians.some((guardian) => Math.hypot(x - guardian.x, y - guardian.y) < 78)) {
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
        (placement) => Math.hypot(result.x - placement.x, result.y - placement.y) < ROUTE_BLOCKER_SEPARATION,
      )
    ) {
      return { ...result, valid: false, reason: "Muito perto de outro Baiacu" };
    }
    return result;
  }

  private upgradeSelectedGuardian(): void {
    if (!this.selectedPlacedGuardianId || this.gameOver) return;
    const guardian = this.guardians.find((candidate) => candidate.instanceId === this.selectedPlacedGuardianId);
    if (!guardian || !guardian.canUpgrade || !guardian.nextUpgrade) return;
    const nextUpgrade = guardian.nextUpgrade;
    const cost = nextUpgrade.cost;
    if (!this.economy.spend(cost)) {
      this.showMessage("Pérolas insuficientes para este upgrade.", 1700);
      this.audio.play("warning");
      return;
    }
    guardian.upgrade();
    this.audio.play("upgrade");
    this.showMessage(`${nextUpgrade.name} adquirido!`, 1900);
    this.emitHud();
    this.renderPlacementState();
  }

  private resolveGuardianAttack(guardian: Guardian, target: Enemy): void {
    const definition = guardian.definition;
    if (definition.attackKind === "projectile") {
      this.projectiles.push(
        new Projectile(
          this,
          guardian.x + 22,
          guardian.y,
          target,
          guardian.projectileSpeed,
          guardian.damage,
          guardian.extraTargets,
          guardian.secondaryDamageMultiplier,
          guardian.predictiveAim,
          guardian.upgradeLevel,
        ),
      );
      this.audio.play("shot");
      this.shockwave(guardian.x + 22, guardian.y, definition.accent, 34);
      return;
    }

    if (definition.attackKind === "chain") {
      const candidates = this.enemies
        .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= guardian.range)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 1 + guardian.extraTargets);
      candidates.forEach((enemy, index) => {
        this.damageEnemy(enemy, guardian.damage * (index === 0 ? 1 : guardian.chainDamageMultiplier));
        enemy.applySlow(definition.slowFactor ?? 1, definition.slowDurationMs ?? 0, this.simulationTimeMs);
      });
      this.lightningEffect(guardian, candidates);
      if (guardian.electricField) this.createElectricField(guardian, target.x, target.y);
      this.audio.play("zap");
      return;
    }

    this.enemies
      .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= guardian.range)
      .forEach((enemy) => {
        this.damageEnemy(enemy, guardian.damage);
      });
    this.shockwave(guardian.x, guardian.y, definition.accent, guardian.range);
    this.audio.play("pulse");
  }

  private damageEnemy(enemy: Enemy, damage: number, playSound = true, continuous = false): void {
    const killed = continuous ? enemy.takeContinuousDamage(damage) : enemy.takeDamage(damage);
    if (playSound) this.audio.play("impact");
    if (killed) {
      this.economy.earn(enemy.definition.reward);
      if (enemy.definition.isBoss) {
        this.currentReversed = false;
        this.showMessage("O Quebra-Marés caiu! A corrente se estabilizou.", 2400);
      }
    }
  }

  private updateBlockers(deltaMs: number): void {
    const blockers = this.guardians.filter(
      (guardian) => guardian.definition.placementMode === "route" && guardian.routeDistance !== null,
    );
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

      const candidates = this.enemies
        .filter(
          (enemy) =>
            !enemy.dead &&
            !enemy.reachedGoal &&
            !enemy.blockedById &&
            hasReachedBlockerContact(
              enemy.pathDistance,
              anchor,
              28 + enemy.definition.hitRadius,
            ),
        )
        .sort((first, second) => second.pathDistance - first.pathDistance);
      const blocked = [...alreadyBlocked, ...candidates.slice(0, blocker.blockCapacity - alreadyBlocked.length)];
      blocked.forEach((enemy) => {
        enemy.setBlocked(blocker.instanceId, enemy.pathDistance);
        if (blocker.contactDamagePerSecond > 0) {
          this.damageEnemy(enemy, blocker.contactDamagePerSecond * (deltaMs / 1000), false, true);
        }
      });
    }
  }

  private createElectricField(guardian: Guardian, x: number, y: number): void {
    const definition = guardian.electricField;
    if (!definition) return;
    let cooldown = this.electricFieldCooldowns.get(guardian.instanceId);
    if (!cooldown) {
      cooldown = new AbilityCooldown();
      this.electricFieldCooldowns.set(guardian.instanceId, cooldown);
    }
    if (!cooldown.tryActivate(this.simulationTimeMs, definition.cooldownMs)) return;
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
      slowFactor: definition.slowFactor,
      slowDurationMs: definition.slowDurationMs,
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
          this.damageEnemy(enemy, field.damage, false);
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

  private cleanupEnemies(): void {
    this.enemies = this.enemies.filter((enemy) => {
      if (!enemy.dead && !enemy.reachedGoal) return true;
      enemy.destroy();
      return false;
    });
  }

  private processWaveEvents(events: readonly WaveSchedulerEvent[]): void {
    for (const event of events) {
      if (event.type === "spawn") {
        const definition = ENEMIES[event.enemyId];
        this.enemies.push(new Enemy(this, `E${++this.enemySerial}`, definition, this.route));
      } else if (event.type === "waveStarted") {
        this.audio.play(event.waveIndex === this.level.waves.length - 1 ? "warning" : "wave");
        this.showMessage(`Onda ${event.waveIndex + 1}: ${this.level.waves[event.waveIndex].name}`, 2200);
      } else if (event.type === "waveCleared") {
        this.showMessage(`Onda ${event.waveIndex + 1} vencida!`, 1800);
      } else if (event.type === "victory") {
        this.finishGame("victory");
      }
    }
  }

  private updateBossCurrent(deltaMs: number): void {
    const bossAlive = this.enemies.some((enemy) => enemy.definition.isBoss && !enemy.dead && !enemy.reachedGoal);
    if (!bossAlive) {
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
      if (this.bossCycleMs >= 6500) {
        this.currentReversed = true;
        this.bossReverseRemainingMs = 3000;
        this.audio.play("warning");
        this.showMessage("Quebra-Marés inverteu a corrente!", 2200);
      }
    }
  }

  private finishGame(result: "victory" | "defeat"): void {
    if (this.gameOver) return;
    this.gameOver = result;
    this.message = result === "victory" ? "RECIFE PROTEGIDO!" : "O RECIFE PRECISA DE REFORÇOS";
    this.messageUntilMs = Number.POSITIVE_INFINITY;
    this.audio.play(result === "victory" ? "upgrade" : "warning");
    this.emitHud();
  }

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
    this.scene.restart();
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

  private emitHud(): void {
    const selected = this.guardians.find((guardian) => guardian.instanceId === this.selectedPlacedGuardianId);
    const nextUpgrade = selected?.nextUpgrade ?? null;
    const snapshot: HudSnapshot = {
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
            name: selected.definition.name,
            upgradeLevel: selected.upgradeLevel,
            maxUpgradeLevel: selected.definition.upgrades.length,
            nextUpgradeName: nextUpgrade?.name ?? null,
            nextUpgradeDescription: nextUpgrade?.description ?? null,
            nextUpgradeCost: nextUpgrade?.cost ?? null,
          }
        : null,
      paused: this.paused,
      muted: this.audio.isMuted,
      debug: { ...this.debugFlags },
      message: this.message,
      gameOver: this.gameOver,
    };
    this.game.canvas.dataset.gameState = this.gameOver ?? this.scheduler.state;
    this.game.canvas.dataset.pearls = String(this.economy.pearls);
    this.game.canvas.dataset.guardians = String(this.guardians.length);
    this.game.canvas.dataset.upgrades = String(
      this.guardians.reduce((total, guardian) => total + guardian.upgradeLevel, 0),
    );
    this.game.canvas.dataset.selected = this.selectedPlacedGuardianId ?? "";
    this.game.canvas.dataset.debug = String(this.debugFlags.enabled);
    this.game.canvas.dataset.paused = String(this.paused);
    const shrimp = this.guardians.find((guardian) => guardian.definition.id === "pistol-shrimp");
    this.game.canvas.dataset.shrimpAssets = String(this.textures.exists(SHRIMP_LEVEL_TEXTURES[0].idle));
    this.game.canvas.dataset.shrimpArt = String(shrimp?.usesSpriteArt ?? false);
    this.game.canvas.dataset.shrimpVisual = shrimp?.currentVisualKey ?? "";
    this.game.canvas.dataset.shrimpTexture = shrimp?.currentTextureKey ?? "";
    this.game.canvas.dataset.projectileTexture = this.projectiles.at(-1)?.textureKey ?? "";
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
        waterRouteClearance: 82,
        waterSeparation: 78,
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
      this.selectionGraphic.fillStyle(selected.definition.accent, 0.06);
      this.selectionGraphic.fillCircle(selected.x, selected.y, selected.range);
      this.selectionGraphic.lineStyle(2, selected.definition.accent, 0.8);
      this.selectionGraphic.strokeCircle(selected.x, selected.y, selected.range);
    }

    const placementMode = this.selectedGuardianId
      ? GUARDIANS[this.selectedGuardianId].placementMode
      : null;
    if (placementMode === "platform") {
      this.placements.forEach((placement) => {
        this.placementGuideGraphic.lineStyle(2, placement.guardian ? 0xff8290 : 0xa5f6d2, placement.guardian ? 0.42 : 0.72);
        this.placementGuideGraphic.strokeCircle(placement.definition.x, placement.definition.y, 38);
      });
    } else if (placementMode === "water") {
      // A validação aparece apenas no marcador sob o cursor; corredores técnicos ficam no debug.
    } else if (placementMode === "route") {
      // O encaixe na corrente é comunicado pelo marcador sob o cursor, sem pintar a rota normal.
    } else {
      this.placementPreviewGraphic.clear();
      this.placementPreviewText.setVisible(false);
    }
    this.renderDebug();
  }

  private drawEnvironment(): void {
    const playfieldCenterY = (HUD_TOP + GAME_HEIGHT - HUD_BOTTOM) / 2;
    const levelBackground = this.add
      .image(GAME_WIDTH / 2, playfieldCenterY, RECIFE_ONE_BACKGROUND_KEY)
      .setDepth(DEPTH.background);
    levelBackground.setScale(GAME_WIDTH / levelBackground.width);

    this.add
      .text(26, 88, "RECIFE 1  ·  RECIFE COSTEIRO", {
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
    const zone = this.level.currents[0];
    for (let index = 0; index < 14; index += 1) {
      const mote = this.add
        .circle(
          zone.x + ((index * 53) % zone.width),
          zone.y + 12 + ((index * 37) % (zone.height - 24)),
          2 + (index % 3),
          0xa4f5ff,
          0.32,
        )
        .setDepth(DEPTH.current + 1);
      this.currentMotes.push(mote);
    }
  }

  private updateCurrentMotes(deltaMs: number): void {
    const zone = this.level.currents[0];
    const direction = this.currentReversed ? -1 : 1;
    this.currentMotes.forEach((mote, index) => {
      mote.x += direction * (22 + (index % 4) * 8) * (deltaMs / 1000);
      mote.y += direction * 4 * (deltaMs / 1000);
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
}
