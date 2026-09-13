import Phaser from "phaser";
import { preloadEnemyArt } from "../assets/enemyArt";
import { GUARDIAN_ART, hasGuardianArt, preloadGuardianUpgradeArt } from "../assets/guardianArt";
import { preloadLevelBackground } from "../assets/levelBackgrounds";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import type { LevelProgressApi } from "../core/LevelProgress";
import { Match } from "../core/match/Match";
import { MatchClock, type MatchSpeed } from "../core/match/MatchClock";
import type { CommandResult, MatchCommand } from "../core/match/MatchCommands";
import type { MatchEvent } from "../core/match/MatchEvents";
import { PLACEMENT_HINTS, validatePlacement } from "../core/PlacementRules";
import { ECONOMY, PLACEMENT } from "../data/balance";
import { difficultyOf, resolveLevelForDifficulty, type DifficultyDefinition } from "../data/difficulty";
import type { MatchResult } from "../core/progression/MatchResult";
import type { MatchOutcome } from "../core/progression/ProgressionService";
import { launchConfigFromUrl, type MatchLaunchConfig } from "../match/MatchLaunchConfig";
import { getProgression } from "../systems/progression";
import { getScreenHost } from "../ui/dom/host";
import { defeatScreen, unlockRevealScreen, victoryScreen } from "../ui/dom/screens/ResultScreens";
import { pauseScreen } from "../ui/dom/screens/PauseScreen";
import { storyScreen } from "../ui/dom/screens/StoryScreen";
import { pendingStory } from "../systems/story";
import { GUARDIANS } from "../data/guardians";
import { getLevel, LEVELS, levelIndex, nextLevelId } from "../data/levels";
import { EventBus, Events } from "../EventBus";
import { CloudGfx, FieldGfx, FlowGfx } from "../objects/AreaEffectViews";
import { EnemyView } from "../objects/EnemyView";
import { GuardianView } from "../objects/GuardianView";
import { ProjectileView } from "../objects/ProjectileView";
import { ArtEffects } from "../systems/ArtEffects";
import { AudioManager } from "../systems/AudioManager";
import { DebugOverlay } from "../systems/DebugOverlay";
import { isDebugAllowed } from "../systems/debugGate";
import { drawLevelBackdrop } from "../systems/LevelBackdrop";
import { MatchEffects } from "../systems/MatchEffects";
import { PlacementGhost } from "../objects/PlacementGhost";
import { InteractableView } from "../objects/InteractableView";
import { encounterForLevel } from "../data/encounters";
import { currentChallenges } from "../core/progression/challenges";
import type { MatchSnapshot } from "../core/match/MatchSnapshot";
import { TutorialDirector } from "../core/tutorial/TutorialDirector";
import { createLevelProgress, getSaveManager } from "../systems/ProgressStore";
import type { BranchId, DebugFlags, GuardianId, HudSnapshot, LevelDefinition, PlacementDefinition, TutorialHint, Vec2, WavePreviewChip } from "../types";

const preventContextMenu = (event: Event): void => event.preventDefault();

interface PlatformZone {
  definition: PlacementDefinition;
  zone: Phaser.GameObjects.Zone;
}

/**
 * Apresentação da partida. Não contém regras: traduz input em comandos do `Match`, consome os eventos
 * do motor para criar/destruir views e efeitos, e publica o `HudSnapshot` para a `UIScene`.
 */
export class GameScene extends Phaser.Scene {
  private level: LevelDefinition = LEVELS[0];
  /** Fase já ajustada pela dificuldade; é ela que o motor recebe. */
  private resolvedLevel: LevelDefinition = LEVELS[0];
  private difficulty: DifficultyDefinition = difficultyOf("normal");
  private launch!: MatchLaunchConfig;
  private progress!: LevelProgressApi;
  private match!: Match;
  private readonly clock = new MatchClock();
  private audio!: AudioManager;
  private artEffects!: ArtEffects;
  private effects!: MatchEffects;
  private debugOverlay!: DebugOverlay;
  private selectionGraphic!: Phaser.GameObjects.Graphics;
  private placementGuideGraphic!: Phaser.GameObjects.Graphics;
  private ghost!: PlacementGhost;
  private debugFlags!: DebugFlags;
  private platforms: PlatformZone[] = [];
  private readonly enemyViews = new Map<string, EnemyView>();
  private readonly guardianViews = new Map<string, GuardianView>();
  private readonly projectileViews = new Map<string, ProjectileView>();
  private readonly fieldViews = new Map<string, FieldGfx>();
  private readonly cloudViews = new Map<string, CloudGfx>();
  private readonly flowViews = new Map<string, FlowGfx>();
  private readonly interactableViews = new Map<string, InteractableView>();
  private pendingEvents: MatchEvent[] = [];
  private currentMotes: Array<{ mote: Phaser.GameObjects.Arc; zoneIndex: number }> = [];
  private loadout: GuardianId[] = [];
  private selectedGuardianId: GuardianId | null = null;
  private selectedPlacedGuardianId: string | null = null;
  private unlockedNextLevelId: string | null = null;
  private gameOverShown = false;
  private debugAllowed = false;
  private message = "";
  private messageUntilMs = 5_000;
  private hudAccumulatorMs = 0;
  private debugAccumulatorMs = 0;
  private tutorial: TutorialDirector | null = null;
  private tutorialSaved = "";
  private readonly unlockAudio = (): void => {
    this.audio?.unlock();
    // A trilha só pode começar depois do primeiro toque do jogador (regra do navegador).
    this.audio?.startMusic(this.match?.snapshot().boss ? "tense" : "calm");
  };

  constructor() {
    super("GameScene");
  }

  init(data: Partial<MatchLaunchConfig> = {}): void {
    const progress = getProgression().progress;
    const query = new URLSearchParams(window.location.search);
    // A tela de preparação manda a configuração pronta; sem ela, valem os atalhos da URL.
    const fromUrl = launchConfigFromUrl(query, {
      unlockedGuardians: progress.unlockedGuardians as GuardianId[],
      lastLoadout: progress.lastLoadout as GuardianId[],
      lastDifficulty: progress.lastDifficulty,
    });
    this.launch = { ...fromUrl, ...data, debug: data.debug ?? fromUrl.debug };
    this.level = getLevel(this.launch.levelId) ?? LEVELS[0];
    this.difficulty = difficultyOf(this.launch.difficulty);
    this.resolvedLevel = resolveLevelForDifficulty(this.level, this.difficulty);
  }

  preload(): void {
    preloadLevelBackground(this, this.level.backgroundKey);
    // O boot traz só as formas base; as evoluções chegam aqui, apenas para o esquadrão desta partida.
    preloadGuardianUpgradeArt(this, this.launch.loadout);
    // Mesma ideia para os inimigos: só as espécies que aparecem nas ondas desta fase.
    preloadEnemyArt(this, [...new Set(this.level.waves.flatMap((wave) => wave.groups.map((group) => group.enemyId)))]);
  }

  create(): void {
    this.progress = createLevelProgress();
    this.enemyViews.clear();
    this.guardianViews.clear();
    this.projectileViews.clear();
    this.fieldViews.clear();
    this.cloudViews.clear();
    this.flowViews.clear();
    this.interactableViews.clear();
    this.pendingEvents = [];
    this.currentMotes = [];
    this.platforms = [];
    this.selectedGuardianId = null;
    this.selectedPlacedGuardianId = null;
    this.unlockedNextLevelId = null;
    this.gameOverShown = false;
    this.clock.reset();
    this.clock.paused = false;
    this.clock.speed = 1;
    this.message = "Escolha um Guardião e toque em uma plataforma.";
    this.messageUntilMs = 5_000;
    this.hudAccumulatorMs = 0;
    this.debugAccumulatorMs = 0;

    // O esquadrão, a dificuldade e os atalhos de debug vêm prontos da preparação ou da URL.
    this.loadout = [...this.launch.loadout];
    const debugFromQuery = this.launch.debug.enabled;
    this.debugAllowed = isDebugAllowed(new URLSearchParams(window.location.search));
    this.match = new Match(this.resolvedLevel, { startWaveIndex: this.launch.debug.startWave });
    this.match.setListener((event) => this.pendingEvents.push(event));
    this.tutorial = this.launch.tutorial ? new TutorialDirector(getSaveManager().progress.tutorial) : null;
    this.tutorialSaved = "";

    this.audio = new AudioManager();
    this.artEffects = new ArtEffects(this);
    this.effects = new MatchEffects({
      scene: this,
      match: this.match,
      effects: this.artEffects,
      audio: this.audio,
      guardianView: (id) => this.guardianViews.get(id),
      projectileView: (id) => this.projectileViews.get(id),
      showMessage: (text, durationMs) => this.showMessage(text, durationMs),
    });
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
    this.createPlatforms();
    this.selectionGraphic = this.add.graphics().setDepth(DEPTH.effects);
    this.placementGuideGraphic = this.add.graphics().setDepth(DEPTH.effects - 1);
    this.ghost = new PlacementGhost(this);
    this.createInteractables();
    this.debugOverlay = new DebugOverlay(this, this.match.route);
    this.registerEvents();
    this.game.canvas.addEventListener("pointerdown", this.unlockAudio, { passive: true });
    this.game.canvas.dataset.screen = "game";
    this.game.canvas.dataset.level = this.level.id;
    this.scene.launch("UIScene", { debugFromQuery, loadout: this.loadout });
    this.emitHud();
  }

  update(_time: number, delta: number): void {
    if (this.match.status !== "running") {
      this.drainEvents();
      return;
    }
    const ticks = this.clock.advance(delta, () => this.match.tick());
    this.drainEvents();
    if (ticks > 0) this.syncViews(ticks * this.match.dtMs);
    if (ticks > 0) this.syncInteractables();
    this.effects.update(this.match.now);
    if (!this.clock.paused) this.updateCurrentMotes(Math.min(delta, 100) * this.clock.speed);

    this.debugAccumulatorMs += delta;
    this.hudAccumulatorMs += delta;
    if (this.debugAccumulatorMs >= 80) {
      this.debugAccumulatorMs = 0;
      this.renderDebug();
    }
    if (this.hudAccumulatorMs >= 100) {
      this.hudAccumulatorMs = 0;
      if (this.match.now >= this.messageUntilMs) this.message = "";
      this.emitHud();
    }
  }

  // ------------------------------------------------------------- eventos do motor

  private drainEvents(): void {
    if (this.pendingEvents.length === 0) return;
    const events = this.pendingEvents;
    this.pendingEvents = [];
    for (const event of events) this.applyEvent(event);
  }

  private applyEvent(event: MatchEvent): void {
    switch (event.type) {
      case "enemySpawned": {
        const enemy = this.match.enemy(event.id);
        if (enemy) this.enemyViews.set(event.id, new EnemyView(this, enemy));
        break;
      }
      case "enemyKilled":
      case "enemyReachedGoal":
        this.enemyViews.get(event.id)?.destroy();
        this.enemyViews.delete(event.id);
        break;
      case "allyJoined": {
        const ally = this.match.guardian(event.id);
        if (ally) this.guardianViews.set(event.id, new GuardianView(this, ally, () => this.selectPlacedGuardian(event.id)));
        this.showMessage(`${GUARDIANS[event.guardianId].name} veio ajudar!`, 2600);
        break;
      }
      case "guardianPlaced": {
        const guardian = this.match.guardian(event.id);
        if (guardian) this.guardianViews.set(event.id, new GuardianView(this, guardian, () => this.selectPlacedGuardian(event.id)));
        break;
      }
      case "guardianSold":
        this.guardianViews.get(event.id)?.destroy();
        this.guardianViews.delete(event.id);
        this.flowViews.get(event.id)?.destroy();
        this.flowViews.delete(event.id);
        break;
      case "projectileFired": {
        const state = this.match.projectiles.find((projectile) => projectile.id === event.id);
        const owner = this.guardianViews.get(event.ownerId);
        if (state && owner) {
          const profile = GUARDIAN_ART[owner.guardian.guardianId];
          this.projectileViews.set(
            event.id,
            new ProjectileView(this, state, {
              textureKey: owner.artTexture("projectile"),
              scale: profile.effectScale,
              impactKey: owner.artTexture("impact"),
              impactScale: profile.effectScale * 0.9,
            }),
          );
        }
        break;
      }
      case "projectileExpired":
        this.projectileViews.get(event.id)?.destroy();
        this.projectileViews.delete(event.id);
        break;
      case "fieldCreated": {
        const state = this.match.fields.find((field) => field.ownerId === event.ownerId);
        const owner = this.match.guardian(event.ownerId);
        if (state && owner) this.fieldViews.set(event.ownerId, new FieldGfx(this, this.artEffects, this.effects.abilityKeyFor(owner, "ring"), state));
        break;
      }
      case "fieldExpired":
        this.fieldViews.get(event.ownerId)?.destroy();
        this.fieldViews.delete(event.ownerId);
        break;
      case "cloudCreated": {
        const state = this.match.clouds.find((cloud) => cloud.ownerId === event.ownerId);
        const owner = this.match.guardian(event.ownerId);
        if (state) this.cloudViews.set(event.ownerId, new CloudGfx(this, this.artEffects, owner ? this.effects.abilityKeyFor(owner, "ring") : null, state));
        break;
      }
      case "cloudExpired":
        this.cloudViews.get(event.ownerId)?.destroy();
        this.cloudViews.delete(event.ownerId);
        break;
      case "levelCompleted":
        this.unlockedNextLevelId = this.progress.complete(this.level.id);
        this.finishGame("victory");
        break;
      case "defeat":
        this.finishGame("defeat");
        break;
      default:
        break;
    }
    // Efeitos, sons e mensagens depois das views existirem (impactos precisam da view do projétil).
    this.effects.handle(event);
  }

  private syncViews(deltaMs: number): void {
    const now = this.match.now;
    const enemyPosition = (id: string): Vec2 | null => {
      const enemy = this.match.enemy(id);
      return enemy ? { x: enemy.x, y: enemy.y } : null;
    };
    for (const view of this.enemyViews.values()) view.sync(now, deltaMs);
    for (const view of this.guardianViews.values()) view.sync(now, enemyPosition);
    for (const view of this.projectileViews.values()) view.sync();
    for (const view of this.fieldViews.values()) view.sync(now);
    for (const view of this.cloudViews.values()) view.sync(now);
    // Zonas de corrente das Tartarugas são derivadas (sem evento): reconcilia por dono a cada frame.
    const active = new Set<string>();
    for (const field of this.match.flowFields) {
      active.add(field.ownerId);
      let view = this.flowViews.get(field.ownerId);
      if (!view) {
        view = new FlowGfx(this, field);
        this.flowViews.set(field.ownerId, view);
      }
      view.sync(field, deltaMs, this.match.route);
    }
    for (const [ownerId, view] of this.flowViews) {
      if (active.has(ownerId)) continue;
      view.destroy();
      this.flowViews.delete(ownerId);
    }
  }

  // ------------------------------------------------------------------ eventos UI

  private registerEvents(): void {
    EventBus.on(Events.selectGuardian, this.selectGuardian, this);
    EventBus.on(Events.upgradeGuardian, this.upgradeSelectedGuardian, this);
    EventBus.on(Events.sellGuardian, this.sellSelectedGuardian, this);
    EventBus.on(Events.togglePause, this.togglePause, this);
    EventBus.on(Events.setSpeed, this.setSpeed, this);
    EventBus.on(Events.toggleMute, this.toggleMute, this);
    EventBus.on(Events.restart, this.restartGame, this);
    EventBus.on(Events.skipCountdown, this.startNextWave, this);
    EventBus.on(Events.startNextWave, this.startNextWave, this);
    EventBus.on(Events.skipTutorial, this.skipTutorial, this);
    EventBus.on(Events.toggleDebug, this.toggleDebug, this);
    EventBus.on(Events.toggleDebugFlag, this.toggleDebugFlag, this);
    EventBus.on(Events.debugCommand, this.runDebugCommand, this);
    EventBus.on(Events.startLevel, this.startLevel, this);
    EventBus.on(Events.openLevelSelect, this.openLevelSelect, this);
    this.input.on("pointermove", this.handleWorldPointerMove, this);
    this.input.on("pointerdown", this.handleWorldPointerDown, this);
    // ESC desfaz a seleção; sem nada selecionado, abre o menu de pause.
    this.input.keyboard?.on("keydown-ESC", this.handleEscape, this);
    // O menu do navegador no botão direito atrapalha o cancelamento por clique.
    this.game.canvas.addEventListener("contextmenu", preventContextMenu);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(Events.selectGuardian, this.selectGuardian, this);
      EventBus.off(Events.upgradeGuardian, this.upgradeSelectedGuardian, this);
      EventBus.off(Events.sellGuardian, this.sellSelectedGuardian, this);
      EventBus.off(Events.togglePause, this.togglePause, this);
      EventBus.off(Events.setSpeed, this.setSpeed, this);
      EventBus.off(Events.toggleMute, this.toggleMute, this);
      EventBus.off(Events.restart, this.restartGame, this);
      EventBus.off(Events.skipCountdown, this.startNextWave, this);
      EventBus.off(Events.startNextWave, this.startNextWave, this);
      EventBus.off(Events.skipTutorial, this.skipTutorial, this);
      EventBus.off(Events.toggleDebug, this.toggleDebug, this);
      EventBus.off(Events.toggleDebugFlag, this.toggleDebugFlag, this);
      EventBus.off(Events.debugCommand, this.runDebugCommand, this);
      EventBus.off(Events.startLevel, this.startLevel, this);
      EventBus.off(Events.openLevelSelect, this.openLevelSelect, this);
      this.input.off("pointermove", this.handleWorldPointerMove, this);
      this.input.off("pointerdown", this.handleWorldPointerDown, this);
      this.input.keyboard?.off("keydown-ESC", this.handleEscape, this);
      this.game.canvas.removeEventListener("contextmenu", preventContextMenu);
      this.ghost.destroy();
      this.game.canvas.removeEventListener("pointerdown", this.unlockAudio);
      this.match.setListener(null);
      this.effects.destroy();
      this.audio.destroy();
      this.debugOverlay.destroy();
    });
  }

  private selectGuardian(id: GuardianId): void {
    if (this.match.status !== "running") return;
    this.selectedGuardianId = this.selectedGuardianId === id ? null : id;
    this.selectedPlacedGuardianId = null;
    this.ghost.setGuardian(this.selectedGuardianId ? GUARDIANS[this.selectedGuardianId] : null);
    if (this.selectedGuardianId) {
      const definition = GUARDIANS[id];
      this.showMessage(`Toque em ${PLACEMENT_HINTS[definition.placementMode]} para posicionar ${definition.name}.`, 2200);
    }
    this.emitHud();
    this.renderPlacementState();
  }

  // ------------------------------------------------------------ posicionamento

  private handlePlatform(platform: PlatformZone): void {
    this.audio.unlock();
    if (this.match.status !== "running") return;
    const occupant = this.match.platformOccupant(platform.definition.id);
    if (occupant) {
      this.selectPlacedGuardian(occupant);
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
    const result = this.place(definition.id, platform.definition.x, platform.definition.y, platform.definition.id);
    if (result.ok) this.showMessage(`${definition.name} protege esta plataforma!`, 1600);
  }

  /** Envia o comando de posicionamento e trata sucesso/recusa (mensagens e seleção). */
  private place(guardianId: GuardianId, x: number, y: number, platformId?: string): CommandResult {
    const definition = GUARDIANS[guardianId];
    const result = this.match.execute({ type: "placeGuardian", guardianId, x, y, platformId });
    this.drainEvents();
    if (!result.ok) {
      this.showMessage(result.reason === "insufficientPearls" ? `Faltam pérolas para ${definition.name}.` : result.message, 1800);
      this.audio.play("warning");
      return result;
    }
    this.selectedGuardianId = null;
    this.selectedPlacedGuardianId = result.instanceId ?? null;
    this.ghost.setGuardian(null);
    this.ghost.hide();
    this.emitHud();
    this.renderPlacementState();
    return result;
  }

  private selectPlacedGuardian(instanceId: string): void {
    const guardian = this.match.guardian(instanceId);
    if (!guardian) return;
    this.selectedPlacedGuardianId = instanceId;
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
    if (this.match.status !== "running" || pointer.y <= HUD_TOP || pointer.y >= GAME_HEIGHT - HUD_BOTTOM) return;
    if (pointer.rightButtonDown()) {
      this.cancelPlacement();
      return;
    }
    if (!this.selectedGuardianId) {
      if (this.selectedPlacedGuardianId) this.clearPlacedSelection();
      return;
    }
    const definition = GUARDIANS[this.selectedGuardianId];
    if (definition.placementMode === "platform") return;
    const result = this.place(definition.id, pointer.worldX, pointer.worldY);
    if (!result.ok) return;
    const guardian = this.match.guardian(result.instanceId ?? "");
    if (definition.placementMode === "route") {
      const verb = guardian?.stats.trap ? "enterrado na correnteza!" : guardian?.stats.blocks ? "bloqueando a correnteza!" : "de guarda na correnteza!";
      this.showMessage(`${definition.name} ${verb}`, 1500);
    } else {
      this.showMessage(
        definition.placementMode === "margin" ? `${definition.name} à espreita na beira da correnteza.` : `${definition.name} posicionado na água.`,
        1500,
      );
    }
  }

  /** Fantasma da unidade sob o cursor: onde ela cairia, o alcance que teria e quanto custa. */
  private handleWorldPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.selectedGuardianId || this.match.status !== "running" || pointer.y <= HUD_TOP || pointer.y >= GAME_HEIGHT - HUD_BOTTOM) {
      this.ghost.hide();
      return;
    }
    const definition = GUARDIANS[this.selectedGuardianId];
    const affordable = this.match.pearls() >= definition.cost;
    const cost = `◉ ${definition.cost}`;

    if (definition.placementMode === "platform") {
      // Na plataforma o fantasma encaixa no centro dela; longe de qualquer uma, segue o cursor em recusa.
      const platform = this.platformNear(pointer.worldX, pointer.worldY);
      const occupied = platform ? this.match.platformOccupant(platform.definition.id) !== null : false;
      this.ghost.show({
        x: platform?.definition.x ?? pointer.worldX,
        y: platform?.definition.y ?? pointer.worldY,
        valid: Boolean(platform) && !occupied,
        affordable,
        label: !platform ? "Precisa de uma plataforma" : occupied ? "Plataforma ocupada" : affordable ? cost : "Pérolas insuficientes",
      });
      return;
    }

    const validation = validatePlacement(definition.placementMode, this.match.placementContext(), { x: pointer.worldX, y: pointer.worldY });
    this.ghost.show({
      x: validation.x,
      y: validation.y,
      valid: validation.valid,
      affordable,
      label: !validation.valid ? validation.reason : affordable ? cost : "Pérolas insuficientes",
    });
  }

  /** Plataforma sob o ponto (a zona de toque tem 94px de lado). */
  private platformNear(x: number, y: number): PlatformZone | null {
    return this.platforms.find((platform) => Math.abs(platform.definition.x - x) <= 47 && Math.abs(platform.definition.y - y) <= 47) ?? null;
  }

  private handleEscape(): void {
    if (this.selectedGuardianId || this.selectedPlacedGuardianId) {
      this.cancelPlacement();
      return;
    }
    this.togglePause();
  }

  /** Desiste do posicionamento (ESC, botão direito ou clique fora). */
  private cancelPlacement(): void {
    if (!this.selectedGuardianId && !this.selectedPlacedGuardianId) return;
    this.selectedGuardianId = null;
    this.selectedPlacedGuardianId = null;
    this.ghost.setGuardian(null);
    this.ghost.hide();
    this.emitHud();
    this.renderPlacementState();
  }


  // ------------------------------------------------------ interagíveis do mapa

  /** Cria as views dos elementos interativos desta fase (nenhuma nas fases sem Encontro). */
  private createInteractables(): void {
    for (const state of this.match.snapshot().interactables) {
      this.interactableViews.set(state.id, new InteractableView(this, state, () => this.touchInteractable(state.id)));
    }
  }

  /** Toque do jogador em um elemento do mapa; o motor decide se conta. */
  private touchInteractable(id: string): void {
    this.audio.unlock();
    if (this.match.status !== "running" || this.clock.paused) return;
    const result = this.match.execute({ type: "interact", interactableId: id });
    this.drainEvents();
    if (!result.ok) {
      if (result.reason !== "interactableDone") this.showMessage(result.message, 1400);
      return;
    }
    this.syncInteractables();
    this.emitHud();
  }

  private syncInteractables(): void {
    if (this.interactableViews.size === 0) return;
    for (const state of this.match.snapshot().interactables) this.interactableViews.get(state.id)?.sync(state);
  }

  // -------------------------------------------------------- upgrade e venda

  private upgradeSelectedGuardian(branchId: BranchId): void {
    if (!this.selectedPlacedGuardianId || this.match.status !== "running") return;
    const result = this.match.execute({ type: "upgradeGuardian", instanceId: this.selectedPlacedGuardianId, branchId });
    this.drainEvents();
    if (!result.ok) {
      if (result.reason === "branchLocked") this.showMessage(result.message, 1900);
      if (result.reason === "insufficientPearls") {
        this.showMessage(result.message, 1700);
        this.audio.play("warning");
      }
      return;
    }
    this.emitHud();
    this.renderPlacementState();
  }

  private sellSelectedGuardian(): void {
    if (!this.selectedPlacedGuardianId || this.match.status !== "running") return;
    const guardian = this.match.guardian(this.selectedPlacedGuardianId);
    const result = this.match.execute({ type: "sellGuardian", instanceId: this.selectedPlacedGuardianId });
    this.drainEvents();
    if (!result.ok || !guardian) return;
    this.selectedPlacedGuardianId = null;
    this.showMessage(`${guardian.definition.name} vendido por ${result.refund ?? 0} pérolas.`, 1800);
    this.emitHud();
    this.renderPlacementState();
  }

  // -------------------------------------------------------------- controles

  private finishGame(result: "victory" | "defeat"): void {
    if (this.gameOverShown) return;
    this.gameOverShown = true;
    this.message = result === "victory" ? `RECIFE PROTEGIDO! +${ECONOMY.levelClearBonus} pérolas` : "O RECIFE PRECISA DE REFORÇOS";
    this.messageUntilMs = Number.POSITIVE_INFINITY;
    this.audio.play(result === "victory" ? "upgrade" : "warning");
    if (result === "victory") this.audio.setMusicMood("victory");
    else this.audio.stopMusic();
    this.syncViews(0);
    this.applyProgression(result === "victory");
    this.emitHud();
  }

  /** Manda o resultado para a progressão e abre a tela de vitória ou derrota. */
  private applyProgression(victory: boolean): void {
    const snapshot = this.match.snapshot();
    const encounter = encounterForLevel(this.level.id);
    // O desafio é redescoberto pela data: a rotação é determinística, então o id continua batendo.
    const challenge = this.launch.challengeId
      ? currentChallenges(
          new Date(),
          getProgression().progress.unlockedGuardians as GuardianId[],
          LEVELS.filter((level) => this.progress.isUnlocked(level.id)).map((level) => level.id),
        ).find((candidate) => candidate.id === this.launch.challengeId)
      : undefined;
    const matchResult: MatchResult = {
      levelId: this.level.id,
      kind: this.level.kind === "encounter" ? "encounter" : "campaign",
      encounterId: encounter?.id ?? this.level.encounterId,
      difficulty: this.difficulty.id,
      victory,
      livesRemaining: snapshot.reef,
      maxLives: snapshot.maxReef,
      loadout: [...this.loadout],
      loadoutOverride: this.launch.loadoutOverride,
      challenge: challenge ? { id: challenge.id, objective: challenge.objective, shells: challenge.shells } : undefined,
      stats: snapshot.stats,
    };
    const progression = getProgression();
    const outcome = progression.applyMatchResult(matchResult, this.level.objectives ?? []);
    this.unlockedNextLevelId = outcome.nextLevelId;
    this.showResultScreen(matchResult, outcome);
  }

  private showResultScreen(result: MatchResult, outcome: MatchOutcome): void {
    const host = getScreenHost(this.game);
    const actions = {
      onRetry: () => {
        host.clear();
        this.restartGame();
      },
      onNextLevel: () => {
        host.clear();
        if (outcome.nextLevelId) this.startLevel(outcome.nextLevelId);
      },
      onChangeSquad: () => {
        host.clear();
        this.openLevelSelect(this.level.id);
      },
      onMap: () => {
        host.clear();
        this.openLevelSelect();
      },
    };
    const screen = outcome.victory
      ? victoryScreen(result, outcome, this.level.name, actions)
      : defeatScreen(result, outcome, this.level.name, actions);
    host.push(screen);
    // As apresentações de Guardiões novos entram por cima, uma de cada vez.
    const pending = getProgression().takePendingReveals();
    [...pending].reverse().forEach((guardianId) => host.push(unlockRevealScreen(guardianId, () => host.pop())));
    // A história de encerramento vem antes de tudo: é ela que o jogador lê primeiro.
    const outro = outcome.victory && outcome.counted ? pendingStory({ type: "levelOutro", levelId: this.level.id }) : undefined;
    if (outro) host.push(storyScreen(outro, () => host.pop()));
  }

  /** O botão Ⅱ pausa a partida e abre o menu (item 36); sair do menu é o que despausa. */
  private togglePause(): void {
    if (this.match.status !== "running") return;
    const host = getScreenHost(this.game);
    if (host.isOpen) {
      this.setPaused(false);
      host.clear();
      return;
    }
    this.setPaused(true);
    const snapshot = this.match.snapshot();
    host.push(
      pauseScreen(
        {
          levelName: this.level.name,
          waveLabel: `${snapshot.wave}/${snapshot.totalWaves}`,
          reefLabel: `${snapshot.reef}/${snapshot.maxReef}`,
          pearls: snapshot.pearls,
        },
        {
          onResume: () => {
            host.clear();
            this.setPaused(false);
          },
          onRestart: () => {
            host.clear();
            this.restartGame();
          },
          onExit: () => {
            host.clear();
            this.openHub();
          },
        },
      ),
    );
  }

  private setPaused(paused: boolean): void {
    this.clock.paused = paused;
    if (paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.emitHud();
  }

  private setSpeed(speed: MatchSpeed): void {
    if (speed !== 1 && speed !== 2 && speed !== 3) return;
    this.clock.speed = speed;
    this.emitHud();
  }

  private toggleMute(): void {
    this.audio.unlock();
    this.audio.toggleMute();
    this.emitHud();
  }

  private restartGame(): void {
    this.scene.stop("UIScene");
    this.scene.restart({ ...this.launch });
  }

  private startLevel(levelId: string): void {
    if (!getLevel(levelId)) return;
    this.scene.stop("UIScene");
    this.scene.restart({ ...this.launch, levelId });
  }

  private openLevelSelect(prepareLevelId?: string): void {
    this.scene.stop("UIScene");
    this.scene.start("LevelSelectScene", prepareLevelId ? { prepareLevelId } : undefined);
  }

  /** Sair pelo pause é ir para casa: o Meu Recife. Vencer continua levando ao mapa, para encadear. */
  private openHub(): void {
    this.scene.stop("UIScene");
    this.scene.start("HubScene");
  }

  private startNextWave(): void {
    if (this.match.status !== "running" || this.clock.paused) return;
    const result = this.match.execute({ type: "startNextWave" });
    if (!result.ok) return;
    this.showMessage("Preparação encerrada. A onda começou!", 1300);
    this.audio.play("wave");
    this.emitHud();
  }

  /**
   * Passo do tutorial para o HUD. O diretor é puro; aqui só montamos o contexto e gravamos o que
   * já foi aprendido (o save guarda os passos, então a dica não volta na próxima partida).
   */
  private tutorialHint(snapshot: MatchSnapshot): TutorialHint | null {
    if (!this.tutorial || this.tutorial.isOver) return null;
    const active = this.tutorial.update({
      levelId: this.level.id,
      waveIndex: snapshot.wave - 1,
      waveRunning: snapshot.waveState === "spawning" || snapshot.waveState === "active",
      pearls: snapshot.pearls,
      guardiansPlaced: snapshot.guardianCount,
      upgradesBought: snapshot.upgradeCount,
      cardSelected: this.selectedGuardianId !== null,
      unitSelected: this.selectedPlacedGuardianId !== null,
      speed: this.clock.speed,
    });
    this.saveTutorialState();
    return active ? { id: active.id, text: active.text, highlight: active.highlight, step: active.index + 1, total: active.total } : null;
  }

  private saveTutorialState(): void {
    if (!this.tutorial) return;
    const next = this.tutorial.state;
    if (JSON.stringify(next) === this.tutorialSaved) return;
    this.tutorialSaved = JSON.stringify(next);
    getSaveManager().update((draft) => {
      draft.tutorial = next;
    });
  }

  /** "PULAR" na dica: encerra o tutorial de vez. */
  private skipTutorial(): void {
    this.tutorial?.skip();
    this.saveTutorialState();
    this.emitHud();
  }

  /** Executa um comando de debug do painel (item 40). Só com o debug liberado. */
  private runDebugCommand(command: MatchCommand): void {
    if (!this.debugAllowed || this.match.status !== "running") return;
    const result = this.match.execute(command);
    this.drainEvents();
    if (result.ok) this.showMessage(`debug: ${command.type.replace("debug.", "")}`, 900);
    this.emitHud();
  }

  private toggleDebug(): void {
    if (!this.debugAllowed) return;
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
    if (this.gameOverShown) return;
    this.message = message;
    this.messageUntilMs = this.match.now + durationMs;
    this.emitHud();
  }

  // -------------------------------------------------------------------- HUD

  private emitHud(): void {
    const snapshot = this.match.snapshot();
    const selected = this.selectedPlacedGuardianId ? this.match.guardian(this.selectedPlacedGuardianId) : undefined;
    const selectedView = selected ? this.guardianViews.get(selected.id) : undefined;
    const gameOver = snapshot.status === "running" ? null : snapshot.status;
    const hud: HudSnapshot = {
      levelId: this.level.id,
      levelName: this.level.name,
      levelIndex: levelIndex(this.level.id),
      levelCount: LEVELS.length,
      nextLevelId: gameOver === "victory" ? (this.unlockedNextLevelId ?? nextLevelId(this.level.id)) : null,
      pearls: snapshot.pearls,
      reefHealth: snapshot.reef,
      maxReefHealth: snapshot.maxReef,
      wave: snapshot.wave,
      totalWaves: snapshot.totalWaves,
      waveState: snapshot.waveState,
      countdownSeconds: snapshot.countdownSeconds,
      canSkipCountdown: snapshot.canStartNextWave,
      speed: this.clock.speed,
      nextWave: snapshot.nextWave
        ? {
            name: snapshot.nextWave.name,
            isBossWave: snapshot.nextWave.isBossWave,
            totalCount: snapshot.nextWave.totalCount,
            chips: snapshot.nextWave.entries.map(
              (entry): WavePreviewChip => ({
                enemyId: entry.enemyId,
                name: entry.name,
                count: entry.count,
                isElite: entry.eliteId !== null,
                isBoss: entry.isBoss,
              }),
            ),
          }
        : null,
      earlyCallBonus: snapshot.canStartNextWave ? Math.floor(snapshot.countdownSeconds * ECONOMY.earlyStartBonusPerSecond) : 0,
      boss: snapshot.boss
        ? {
            name: snapshot.boss.name,
            title: snapshot.boss.title,
            healthRatio: snapshot.boss.healthRatio,
            phaseIndex: snapshot.boss.phaseIndex,
            phaseCount: snapshot.boss.phaseCount,
          }
        : null,
      difficulty: this.difficulty.id,
      loadout: [...this.loadout],
      selectedGuardianId: this.selectedGuardianId,
      selectedPlacedGuardian: selected
        ? {
            instanceId: selected.id,
            guardianId: selected.guardianId,
            name: selected.definition.name,
            upgradeLevel: selected.upgradeLevel,
            maxUpgradeLevel: selected.maxUpgradeLevel,
            branchId: selected.branchId,
            branchName: selected.branch?.name ?? null,
            branchColor: selected.branch?.color ?? null,
            artVariant: selectedView?.artVariantFolder ?? "base",
            options: selected.options,
            branches: selected.branchStatuses,
            invested: selected.invested,
            sellValue: selected.sellValueAt(ECONOMY.sellRefundRate),
            damage: selected.stats.damage,
            range: selected.stats.range,
            cooldownMs: selected.stats.cooldownMs,
          }
        : null,
      paused: this.clock.paused,
      muted: this.audio.isMuted,
      debug: { ...this.debugFlags },
      message: this.message,
      tutorial: this.tutorialHint(snapshot),
      gameOver,
    };
    const dataset = this.game.canvas.dataset;
    dataset.gameState = gameOver ?? snapshot.waveState;
    dataset.level = this.level.id;
    dataset.nextLevel = hud.nextLevelId ?? "";
    dataset.wave = String(snapshot.wave);
    dataset.pearls = String(snapshot.pearls);
    dataset.reef = String(snapshot.reef);
    dataset.guardians = String(snapshot.guardianCount);
    dataset.upgrades = String(snapshot.upgradeCount);
    dataset.selected = this.selectedPlacedGuardianId ?? "";
    dataset.selectedBranch = selected?.branchId ?? "";
    dataset.selectedOptions = selected ? String(selected.options.length) : "";
    dataset.selectedVariant = selectedView?.artVariantFolder ?? "";
    dataset.sellValue = selected ? String(selected.sellValueAt(ECONOMY.sellRefundRate)) : "";
    dataset.loadout = this.loadout.join(",");
    dataset.debug = String(this.debugFlags.enabled);
    dataset.paused = String(this.clock.paused);
    dataset.tutorial = hud.tutorial?.id ?? "";
    dataset.interactables = snapshot.interactables.map((item) => `${item.id}:${item.state}:${Math.round(item.progress * 100)}`).join(",");
    dataset.speed = String(this.clock.speed);
    dataset.difficulty = this.difficulty.id;
    dataset.nextWave = hud.nextWave ? hud.nextWave.chips.map((chip) => `${chip.enemyId}:${chip.count}${chip.isElite ? "+" : ""}`).join(",") : "";
    dataset.bossPhase = snapshot.boss ? `${snapshot.boss.phaseIndex + 1}/${snapshot.boss.phaseCount}` : "";
    const shrimp = [...this.guardianViews.values()].find((view) => view.guardian.guardianId === "pistol-shrimp");
    dataset.shrimpAssets = String(hasGuardianArt(this, "pistol-shrimp"));
    dataset.shrimpArt = String(shrimp?.usesSpriteArt ?? false);
    dataset.shrimpVisual = shrimp?.currentVisualKey ?? "";
    dataset.shrimpTexture = shrimp?.currentTextureKey ?? "";
    const lastProjectile = [...this.projectileViews.values()].at(-1);
    dataset.projectileTexture = lastProjectile?.textureKey ?? "";
    const boss = snapshot.boss;
    dataset.boss = boss ? `${boss.x.toFixed(0)},${boss.y.toFixed(0)},${boss.speed.toFixed(1)},${Math.ceil(boss.health)},${boss.blockedById ?? "-"}` : "";
    dataset.enemies = String(snapshot.aliveEnemies);
    dataset.trapPhase = snapshot.trapPhase ?? "";
    EventBus.emit(Events.hudUpdate, hud);
  }

  private renderDebug(): void {
    this.debugOverlay.render(
      this.debugFlags,
      this.match.guardians,
      this.match.enemies,
      this.match.projectiles,
      this.resolvedLevel.currents,
      this.match.currentReversed,
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
        platforms: this.level.placements.map((placement) => ({ x: placement.x, y: placement.y })),
        routeBlockers: this.match.routeOccupants.map((unit, index) => ({
          id: `rota-${index + 1}`,
          x: unit.x,
          y: unit.y,
          label: this.match.guardian(unit.guardianId)?.definition.shortName.toUpperCase() ?? "ROTA",
        })),
      },
      { flowFields: this.match.flowFields, now: this.match.now },
    );
  }

  private renderPlacementState(): void {
    this.selectionGraphic.clear();
    this.placementGuideGraphic.clear();
    const selected = this.selectedPlacedGuardianId ? this.match.guardian(this.selectedPlacedGuardianId) : undefined;
    if (selected) {
      const color = selected.branch?.color ?? selected.definition.accent;
      this.selectionGraphic.fillStyle(color, 0.06);
      this.selectionGraphic.fillCircle(selected.x, selected.y, selected.range);
      this.selectionGraphic.lineStyle(2, color, 0.8);
      this.selectionGraphic.strokeCircle(selected.x, selected.y, selected.range);
    }

    const placementMode = this.selectedGuardianId ? GUARDIANS[this.selectedGuardianId].placementMode : null;
    if (placementMode === "platform") {
      this.platforms.forEach((platform) => {
        const occupied = this.match.platformOccupant(platform.definition.id) !== null;
        this.placementGuideGraphic.lineStyle(2, occupied ? 0xff8290 : 0xa5f6d2, occupied ? 0.42 : 0.72);
        this.placementGuideGraphic.strokeCircle(platform.definition.x, platform.definition.y, 38);
      });
    } else if (placementMode === "margin") {
      // Faixa da margem: duas linhas paralelas à rota mostram onde o Tubarão pode ficar.
      this.placementGuideGraphic.lineStyle(PLACEMENT.marginMax * 2, 0x67f2ac, 0.06);
      this.strokeRoute(this.placementGuideGraphic);
      this.placementGuideGraphic.lineStyle(PLACEMENT.marginMin * 2, 0x031d2d, 0.12);
      this.strokeRoute(this.placementGuideGraphic);
    } else if (placementMode === null) {
      this.ghost.hide();
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
      const levelBackground = this.add.image(GAME_WIDTH / 2, playfieldCenterY, this.level.backgroundKey).setDepth(DEPTH.background);
      levelBackground.setScale(GAME_WIDTH / levelBackground.width);
    } else {
      drawLevelBackdrop(this, this.level);
    }

    // O nome da fase é da `UIScene`: ela desenha a plaquinha no mesmo canto, na pele do HUD.
  }

  private createPlatforms(): void {
    this.level.placements.forEach((definition) => {
      const zone = this.add.zone(definition.x, definition.y, 94, 94).setDepth(DEPTH.pads + 1);
      zone.setInteractive({ useHandCursor: true });
      const platform: PlatformZone = { definition, zone };
      zone.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.handlePlatform(platform);
      });
      this.platforms.push(platform);
    });
  }

  private createCurrentMotes(): void {
    this.level.currents.forEach((zone, zoneIndex) => {
      for (let index = 0; index < 14; index += 1) {
        const mote = this.add
          .circle(zone.x + ((index * 53) % zone.width), zone.y + 12 + ((index * 37) % Math.max(1, zone.height - 24)), 2 + (index % 3), 0xa4f5ff, 0.32)
          .setDepth(DEPTH.current + 1);
        this.currentMotes.push({ mote, zoneIndex });
      }
    });
  }

  private updateCurrentMotes(deltaMs: number): void {
    const reversed = this.match.currentReversed;
    const sign = reversed ? -1 : 1;
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
      mote.setFillStyle(reversed ? 0xffa080 : 0xa4f5ff, 0.36);
    });
  }
}
