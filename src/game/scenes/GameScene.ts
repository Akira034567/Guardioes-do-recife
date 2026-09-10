import Phaser from "phaser";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
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
import type { DebugFlags, GuardianId, HudSnapshot, PlacementDefinition } from "../types";

interface PlacementView {
  definition: PlacementDefinition;
  guardian: Guardian | null;
  graphic: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone;
}

export class GameScene extends Phaser.Scene {
  private readonly level = RECIFE_ONE;
  private route!: RoutePath;
  private economy!: Economy;
  private scheduler!: WaveScheduler;
  private audio!: AudioManager;
  private debugOverlay!: DebugOverlay;
  private selectionGraphic!: Phaser.GameObjects.Graphics;
  private debugFlags!: DebugFlags;
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
    };

    this.drawEnvironment();
    this.createCurrentMotes();
    this.createPlacements();
    this.selectionGraphic = this.add.graphics().setDepth(DEPTH.effects);
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

    for (const projectile of this.projectiles) {
      const result = projectile.tick(safeDelta, this.level.currents, this.currentReversed, this.enemies);
      result.hits.forEach((enemy) => this.damageEnemy(enemy, projectile.damage));
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
    EventBus.on(Events.toggleDebug, this.toggleDebug, this);
    EventBus.on(Events.toggleDebugFlag, this.toggleDebugFlag, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(Events.selectGuardian, this.selectGuardian, this);
      EventBus.off(Events.upgradeGuardian, this.upgradeSelectedGuardian, this);
      EventBus.off(Events.togglePause, this.togglePause, this);
      EventBus.off(Events.toggleMute, this.toggleMute, this);
      EventBus.off(Events.restart, this.restartGame, this);
      EventBus.off(Events.toggleDebug, this.toggleDebug, this);
      EventBus.off(Events.toggleDebugFlag, this.toggleDebugFlag, this);
      this.game.canvas.removeEventListener("pointerdown", this.unlockAudio);
      this.audio.destroy();
      this.debugOverlay.destroy();
    });
  }

  private selectGuardian(id: GuardianId): void {
    if (this.gameOver) return;
    this.selectedGuardianId = this.selectedGuardianId === id ? null : id;
    this.selectedPlacedGuardianId = null;
    if (this.selectedGuardianId) this.showMessage(`Toque em uma plataforma para posicionar ${GUARDIANS[id].name}.`, 2200);
    this.emitHud();
    this.renderSelection();
  }

  private handlePlacement(placement: PlacementView): void {
    this.audio.unlock();
    if (this.gameOver) return;
    if (placement.guardian) {
      this.selectedPlacedGuardianId = placement.guardian.instanceId;
      this.selectedGuardianId = null;
      this.showMessage(`${placement.guardian.definition.name} selecionado.`, 1400);
      this.emitHud();
      this.renderSelection();
      return;
    }

    if (!this.selectedGuardianId) {
      this.showMessage("Escolha primeiro um Guardião no painel inferior.", 1800);
      return;
    }

    const definition = GUARDIANS[this.selectedGuardianId];
    if (!this.economy.spend(definition.cost)) {
      this.showMessage(`Faltam pérolas para ${definition.name}.`, 1800);
      this.audio.play("warning");
      return;
    }

    const guardian = new Guardian(
      this,
      `G${++this.guardianSerial}`,
      definition,
      placement.definition.x,
      placement.definition.y,
    );
    placement.guardian = guardian;
    this.guardians.push(guardian);
    this.selectedPlacedGuardianId = guardian.instanceId;
    this.audio.play("buy");
    this.showMessage(`${definition.name} protege esta plataforma!`, 1600);
    this.emitHud();
    this.renderSelection();
  }

  private upgradeSelectedGuardian(): void {
    if (!this.selectedPlacedGuardianId || this.gameOver) return;
    const guardian = this.guardians.find((candidate) => candidate.instanceId === this.selectedPlacedGuardianId);
    if (!guardian || guardian.upgraded) return;
    const cost = guardian.definition.upgrade.cost;
    if (!this.economy.spend(cost)) {
      this.showMessage("Pérolas insuficientes para este upgrade.", 1700);
      this.audio.play("warning");
      return;
    }
    guardian.upgrade();
    this.audio.play("upgrade");
    this.showMessage(`${guardian.definition.upgrade.name} adquirido!`, 1900);
    this.emitHud();
    this.renderSelection();
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
          definition.projectileSpeed ?? 400,
          guardian.damage,
          guardian.extraTargets,
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
      candidates.forEach((enemy) => {
        this.damageEnemy(enemy, guardian.damage);
        enemy.applySlow(definition.slowFactor ?? 1, definition.slowDurationMs ?? 0, this.simulationTimeMs);
      });
      this.lightningEffect(guardian, candidates);
      this.audio.play("zap");
      return;
    }

    const factor = guardian.upgraded
      ? (definition.slowFactor ?? 1) * (definition.upgrade.slowMultiplier ?? 1)
      : 1;
    this.enemies
      .filter((enemy) => !enemy.dead && !enemy.reachedGoal && enemy.distanceTo(guardian.x, guardian.y) <= guardian.range)
      .forEach((enemy) => {
        this.damageEnemy(enemy, guardian.damage);
        if (guardian.upgraded) enemy.applySlow(factor, definition.slowDurationMs ?? 0, this.simulationTimeMs);
      });
    this.shockwave(guardian.x, guardian.y, definition.accent, guardian.range);
    this.audio.play("pulse");
  }

  private damageEnemy(enemy: Enemy, damage: number): void {
    const killed = enemy.takeDamage(damage);
    this.audio.play("impact");
    if (killed) {
      this.economy.earn(enemy.definition.reward);
      if (enemy.definition.isBoss) {
        this.currentReversed = false;
        this.showMessage("O Quebra-Marés caiu! A corrente se estabilizou.", 2400);
      }
    }
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
    const snapshot: HudSnapshot = {
      pearls: this.economy.pearls,
      reefHealth: this.reefHealth,
      maxReefHealth: this.level.reefHealth,
      wave: this.scheduler.currentWave,
      totalWaves: this.scheduler.totalWaves,
      waveState: this.scheduler.state,
      countdownSeconds: this.scheduler.countdownSeconds,
      selectedGuardianId: this.selectedGuardianId,
      selectedPlacedGuardian: selected
        ? {
            instanceId: selected.instanceId,
            name: selected.definition.name,
            upgraded: selected.upgraded,
            upgradeName: selected.definition.upgrade.name,
            upgradeDescription: selected.definition.upgrade.description,
            upgradeCost: selected.definition.upgrade.cost,
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
    this.game.canvas.dataset.upgrades = String(this.guardians.filter((guardian) => guardian.upgraded).length);
    this.game.canvas.dataset.debug = String(this.debugFlags.enabled);
    this.game.canvas.dataset.paused = String(this.paused);
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
    );
  }

  private renderSelection(): void {
    this.selectionGraphic.clear();
    const selected = this.guardians.find((guardian) => guardian.instanceId === this.selectedPlacedGuardianId);
    if (selected) {
      this.selectionGraphic.fillStyle(selected.definition.accent, 0.06);
      this.selectionGraphic.fillCircle(selected.x, selected.y, selected.range);
      this.selectionGraphic.lineStyle(2, selected.definition.accent, 0.8);
      this.selectionGraphic.strokeCircle(selected.x, selected.y, selected.range);
      this.selectionGraphic.lineStyle(3, 0xffe17d, 1);
      this.selectionGraphic.strokeCircle(selected.x, selected.y, 40);
    }
    this.renderDebug();
  }

  private drawEnvironment(): void {
    const background = this.add.graphics().setDepth(DEPTH.background);
    background.fillGradientStyle(0x0c7292, 0x0c7292, 0x043b5c, 0x043b5c, 1);
    background.fillRect(0, HUD_TOP, GAME_WIDTH, GAME_HEIGHT - HUD_TOP - HUD_BOTTOM);

    for (let row = 0; row < 7; row += 1) {
      background.lineStyle(2, 0x76e5ec, 0.08 + row * 0.01);
      background.beginPath();
      for (let x = -20; x <= GAME_WIDTH + 20; x += 40) {
        const y = HUD_TOP + 34 + row * 77 + Math.sin(x / 60 + row) * 9;
        if (x === -20) background.moveTo(x, y);
        else background.lineTo(x, y);
      }
      background.strokePath();
    }

    this.drawSeabedDecor(background);

    const pathGraphic = this.add.graphics().setDepth(DEPTH.path);
    pathGraphic.lineStyle(92, 0x8d6d43, 0.45);
    this.strokeRoute(pathGraphic);
    pathGraphic.lineStyle(78, 0xf0cf8d, 1);
    this.strokeRoute(pathGraphic);
    pathGraphic.lineStyle(4, 0xffecbd, 0.55);
    this.strokeRoute(pathGraphic);

    for (let distance = 45; distance < this.route.totalLength; distance += 78) {
      const point = this.route.getPointAtDistance(distance);
      pathGraphic.fillStyle(0xb18b56, 0.45);
      pathGraphic.fillCircle(point.x, point.y + Math.sin(distance) * 13, 3);
    }

    const current = this.level.currents[0];
    const currentGraphic = this.add.graphics().setDepth(DEPTH.current);
    currentGraphic.fillStyle(0x36dff2, 0.09);
    currentGraphic.fillRoundedRect(current.x, current.y, current.width, current.height, 22);
    currentGraphic.lineStyle(2, 0x8bf4ff, 0.25);
    currentGraphic.strokeRoundedRect(current.x, current.y, current.width, current.height, 22);

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

  private drawSeabedDecor(graphics: Phaser.GameObjects.Graphics): void {
    const rocks = [
      [90, 155, 30], [190, 540, 24], [405, 120, 34], [630, 510, 27], [910, 120, 31], [1180, 520, 38],
      [1150, 190, 20], [70, 470, 18], [690, 125, 16],
    ];
    rocks.forEach(([x, y, radius], index) => {
      graphics.fillStyle(index % 2 ? 0x174d57 : 0x123e51, 1);
      graphics.fillCircle(x, y, radius);
      graphics.fillStyle(0x297369, 0.65);
      graphics.fillCircle(x - radius * 0.25, y - radius * 0.28, radius * 0.55);
    });

    const corals = [[120, 240], [260, 120], [430, 565], [680, 560], [930, 560], [1170, 250]];
    corals.forEach(([x, y], index) => {
      const color = index % 2 ? 0xff6e68 : 0xd55bd1;
      graphics.lineStyle(7, color, 0.9);
      graphics.lineBetween(x, y, x, y - 28);
      graphics.lineBetween(x, y - 13, x - 12, y - 25);
      graphics.lineBetween(x, y - 17, x + 13, y - 34);
    });
  }

  private strokeRoute(graphics: Phaser.GameObjects.Graphics): void {
    graphics.beginPath();
    this.route.points.forEach((point, index) => {
      if (index === 0) graphics.moveTo(point.x, point.y);
      else graphics.lineTo(point.x, point.y);
    });
    graphics.strokePath();
  }

  private createPlacements(): void {
    this.level.placements.forEach((definition) => {
      const graphic = this.add.graphics().setDepth(DEPTH.pads);
      graphic.fillStyle(0x082f3f, 0.45);
      graphic.fillCircle(definition.x + 3, definition.y + 7, 48);
      graphic.fillStyle(0xe4bd78, 1);
      graphic.fillCircle(definition.x, definition.y, 44);
      graphic.lineStyle(3, 0xffe4ad, 0.8);
      graphic.strokeCircle(definition.x, definition.y, 37);
      for (let angle = -1.1; angle <= 1.1; angle += 0.36) {
        graphic.lineBetween(
          definition.x,
          definition.y + 17,
          definition.x + Math.sin(angle) * 31,
          definition.y - Math.cos(angle) * 28,
        );
      }
      const zone = this.add.zone(definition.x, definition.y, 94, 94).setDepth(DEPTH.pads + 1);
      zone.setInteractive({ useHandCursor: true });
      const view: PlacementView = { definition, guardian: null, graphic, zone };
      zone.on("pointerdown", () => this.handlePlacement(view));
      zone.on("pointerover", () => graphic.setAlpha(0.82));
      zone.on("pointerout", () => graphic.setAlpha(1));
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
