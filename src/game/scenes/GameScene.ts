import Phaser from "phaser";
import { preloadEnemyArt } from "../assets/enemyArt";
import { preloadGoldenArt } from "../assets/goldenArt";
import { preloadStatusArt } from "../assets/statusArt";
import { GoldenCrownView } from "../objects/GoldenCrownView";
import { GoldenFishBadge } from "../objects/GoldenFishBadge";
import { GUARDIAN_ART, hasGuardianArt, preloadGuardianUpgradeArt } from "../assets/guardianArt";
import { preloadLevelBackground } from "../assets/levelBackgrounds";
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP } from "../constants";
import type { LevelProgressApi } from "../core/LevelProgress";
import { Match } from "../core/match/Match";
import { MatchClock, type MatchSpeed } from "../core/match/MatchClock";
import type { CommandResult, MatchCommand } from "../core/match/MatchCommands";
import type { MatchEvent } from "../core/match/MatchEvents";
import { freeModesOf, PLACEMENT_HINTS, placementModesOf, validateAnyPlacement } from "../core/PlacementRules";
import { BOSS_CURRENT, ECONOMY, PLACEMENT } from "../data/balance";
import { difficultyOf, resolveLevelForDifficulty, type DifficultyDefinition } from "../data/difficulty";
import type { MatchResult } from "../core/progression/MatchResult";
import type { MatchOutcome } from "../core/progression/ProgressionService";
import { launchConfigFromUrl, type MatchLaunchConfig } from "../match/MatchLaunchConfig";
import { getProgression } from "../systems/progression";
import { getSettings } from "../systems/settings";
import { getScreenHost } from "../ui/dom/host";
import { defeatScreen, pendingEncounterFor, unlockRevealScreen, victoryScreen } from "../ui/dom/screens/ResultScreens";
import { pauseScreen } from "../ui/dom/screens/PauseScreen";
import { storyScreen } from "../ui/dom/screens/StoryScreen";
import { pendingStory } from "../systems/story";
import { GUARDIANS } from "../data/guardians";
import { getLevel, LEVELS, levelIndex, nextLevelId } from "../data/levels";
import { EventBus, Events } from "../EventBus";
import { CloudGfx, FieldGfx, FlowGfx } from "../objects/AreaEffectViews";
import { EnemyView } from "../objects/EnemyView";
import { WeakPointView } from "../objects/WeakPointView";
import { GuardianView } from "../objects/GuardianView";
import { ProjectileView } from "../objects/ProjectileView";
import { ArtEffects } from "../systems/ArtEffects";
import { AudioManager } from "../systems/AudioManager";
import { DebugOverlay } from "../systems/DebugOverlay";
import { isDebugAllowed } from "../systems/debugGate";
import { devAssert, DIAGNOSTICS_ON, lifecycleLog, publishDiagnostics } from "../systems/devLog";
import { Disposables } from "../systems/Disposables";
import { MatchLifecycle } from "../match/MatchLifecycle";
import { transitionTo } from "../systems/sceneTransition";
import { drawLevelBackdrop } from "../systems/LevelBackdrop";
import { MatchEffects } from "../systems/MatchEffects";
import { PlacementGhost } from "../objects/PlacementGhost";
import { InteractableView } from "../objects/InteractableView";
import { encounterForLevel, type EncounterDefinition } from "../data/encounters";
import { currentChallenges } from "../core/progression/challenges";
import type { MatchSnapshot } from "../core/match/MatchSnapshot";
import { TutorialDirector } from "../core/tutorial/TutorialDirector";
import { createLevelProgress, getSaveManager } from "../systems/ProgressStore";
import type {
  BranchId,
  DebugFlags,
  GuardianDefinition,
  GuardianId,
  HudSnapshot,
  LevelDefinition,
  PlacementDefinition,
  TutorialHint,
  Vec2,
  WavePreviewChip,
} from "../types";

const preventContextMenu = (event: Event): void => event.preventDefault();

/** Verde da faixa de margem e o único alfa que ela usa. Ver `GameScene.marginBand()`. 🔶 placeholders. */
const MARGIN_BAND_COLOR = 0x67f2ac;
const MARGIN_BAND_ALPHA = 0.3;

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
  /** Fases explícitas da partida (item 8): quem pergunta em que pé a partida está pergunta aqui. */
  private lifecycle = new MatchLifecycle();
  /** Tudo que `destroyGame()` precisa desfazer, na ordem inversa da criação. */
  private disposables = new Disposables();
  /** Acumulador do watchdog de input, para não conferir a invariante a 60 Hz. */
  private watchdogAccumulatorMs = 0;
  /** Passado à `UIScene` no `startGame`; fica guardado porque quem o resolve é o `initializeGame`. */
  private pendingDebugFromQuery = false;
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
  /** Faixa da margem, pintada uma vez por fase. Ver `marginBand()`. */
  private marginBandTexture: Phaser.GameObjects.RenderTexture | null = null;
  private ghost!: PlacementGhost;
  private debugFlags!: DebugFlags;
  private platforms: PlatformZone[] = [];
  private readonly enemyViews = new Map<string, EnemyView>();
  /** Pontos fracos de chefe: vivem à parte porque não são inimigos de onda (item 11). */
  private readonly weakPointViews = new Map<string, WeakPointView>();
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
  /** O Peixinho esperando no canto; some quando o jogador o arrasta até um Guardião. */
  private goldenBadge: GoldenFishBadge | null = null;
  private crownView: GoldenCrownView | null = null;
  /** Arraste em curso: o jogador apertou uma carta e ainda não soltou. Ver `handleWorldPointerUp`. */
  private dragPlacing = false;
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
    // Peixinho Dourado: toda fase concede um, então a arte vem sempre.
    preloadGoldenArt(this);
    // Ícones de status: leves e usados em qualquer fase.
    preloadStatusArt(this);
  }

  create(): void {
    this.initializeGame();
    this.startGame();
  }

  // ------------------------------------------------------------- ciclo de vida
  //
  // Cinco passos explícitos (item 8). O ciclo do Phaser já existe, mas não diz nada sobre o estado
  // da PARTIDA — e era justamente aí que o jogo travava sem deixar rastro. Note que o Phaser
  // REAPROVEITA a instância da cena entre um `scene.start` e o seguinte: tudo que sobrevive precisa
  // ser reposto no `initializeGame`, e tudo que foi criado precisa ser desfeito no `destroyGame`.

  /** Monta a partida: estado zerado, motor novo, views, listeners. Ainda não começa a rodar. */
  private initializeGame(): void {
    this.lifecycle = new MatchLifecycle();
    this.lifecycle.transition("initializing");
    this.disposables = new Disposables();
    // O Phaser reaproveita a instância da cena: a faixa da margem é da rota da fase ANTERIOR e o
    // display list dela já foi embora. Repintar é barato; guardar a referência velha, não.
    this.marginBandTexture = null;
    publishDiagnostics();

    // A `GameScene` era a única cena que não limpava a camada HTML ao entrar. Um overlay que
    // sobrevivesse a uma troca de cena deixava `game.input.enabled = false` (ScreenHost.sync) com o
    // jogo desenhando normalmente: vivo e surdo, sem erro nenhum no console.
    getScreenHost(this.game).clear();
    this.game.input.enabled = true;

    this.progress = createLevelProgress();
    this.enemyViews.clear();
    this.weakPointViews.clear();
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
    this.match = new Match(this.resolvedLevel, {
      startWaveIndex: this.launch.debug.startWave,
      // Maestria é progressão permanente: entra resolvida, o motor não conhece o save.
      masteryLevels: getProgression().masteryLevels(),
    });
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
      // Desligada por padrão de propósito: ver o item 13.
      routeNodes: false,
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
    this.pendingDebugFromQuery = debugFromQuery;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyGame());
    this.lifecycle.transition("ready");
  }

  /** Liga o HUD e entrega a partida ao jogador. */
  private startGame(): void {
    this.scene.launch("UIScene", { debugFromQuery: this.pendingDebugFromQuery, loadout: this.loadout });
    this.lifecycle.transition("running");
    this.publishLifecycle();
    this.emitHud();
  }

  /** Pausa e retomada. O relógio para; as views continuam desenhando. */
  private pauseGame(paused: boolean): void {
    this.clock.paused = paused;
    if (paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    // Pausar depois do fim da partida (a tela de resultado) não é uma fase nova: o ciclo já está
    // em `finished` e continuar de lá é ilegal de propósito.
    if (this.lifecycle.phase === "running" || this.lifecycle.phase === "paused") {
      this.lifecycle.transition(paused ? "paused" : "running");
      this.publishLifecycle();
    }
  }

  /**
   * Reinício limpo: uma partida nova, do zero. Passa pelo `transitionTo`, que limpa a camada HTML e
   * desliga o input durante a troca — dois cliques rápidos não disparam dois `scene.start`.
   *
   * Repare que o desmonte NÃO acontece aqui: o fade dura alguns quadros e o `update()` continuaria
   * rodando sobre um motor já desfeito. Quem desmonta é o `SHUTDOWN`, que o `scene.start` dispara.
   */
  private resetGame(levelId?: string): void {
    if (!this.lifecycle.isLive) return;
    lifecycleLog("match", "reset", { levelId: levelId ?? this.level.id });
    transitionTo(this, "GameScene", { ...this.launch, ...(levelId ? { levelId } : {}) });
  }

  /**
   * Desfaz tudo: listeners, áudio, efeitos, views, overlays e referências. Idempotente, porque o
   * `SHUTDOWN` pode chegar depois de uma saída manual.
   */
  private destroyGame(): void {
    if (!this.lifecycle.isLive) return;
    this.lifecycle.transition("destroying");
    this.disposables.disposeAll();

    // O Phaser REAPROVEITA a cena entre partidas: o que nasce fora dos mapas precisa morrer aqui.
    this.goldenBadge?.destroy();
    this.goldenBadge = null;
    this.crownView?.destroy();
    this.crownView = null;
    this.enemyViews.forEach((view) => view.destroy());
    this.weakPointViews.forEach((view) => view.destroy());
    this.guardianViews.forEach((view) => view.destroy());
    this.projectileViews.forEach((view) => view.destroy());
    this.fieldViews.forEach((view) => view.destroy());
    this.cloudViews.forEach((view) => view.destroy());
    this.flowViews.forEach((view) => view.destroy());
    this.interactableViews.forEach((view) => view.destroy());
    this.enemyViews.clear();
    this.weakPointViews.clear();
    this.guardianViews.clear();
    this.projectileViews.clear();
    this.fieldViews.clear();
    this.cloudViews.clear();
    this.flowViews.clear();
    this.interactableViews.clear();
    this.pendingEvents = [];
    this.currentMotes = [];
    this.platforms = [];
    this.tutorial = null;
    this.selectedGuardianId = null;
    this.selectedPlacedGuardianId = null;
    this.dragPlacing = false;

    this.scene.stop("UIScene");
    getScreenHost(this.game).clear();
    this.game.input.enabled = true;
    this.lifecycle.transition("destroyed");
    this.publishLifecycle();
  }

  private publishLifecycle(): void {
    this.game.canvas.dataset.lifecycle = this.lifecycle.phase;
  }

  update(_time: number, delta: number): void {
    this.checkInputWatchdog(delta);
    if (this.match.status !== "running") {
      // Os efeitos do último quadro (número de dano, explosão do abate final) precisam terminar
      // mesmo com a partida encerrada; antes eles congelavam no ar.
      this.drainEvents();
      this.effects.update(this.match.now);
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
      case "weakPointSpawned": {
        const weakPoint = this.match.weakPoints.find((point) => point.id === event.id);
        if (weakPoint) this.weakPointViews.set(event.id, new WeakPointView(this, weakPoint));
        return;
      }
      case "weakPointDestroyed": {
        const view = this.weakPointViews.get(event.id);
        this.weakPointViews.delete(event.id);
        // `parentGone` é o chefe saindo de campo: some junto, sem espetáculo de ruptura.
        if (!view) return;
        if (event.reason === "broken") view.playBreak(() => {});
        else view.destroy();
        return;
      }
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
      case "goldenFishAwarded":
        this.spawnGoldenBadge();
        this.showMessage("O Peixinho Dourado chegou! Arraste-o até o Guardião que você quer coroar.", 4600);
        break;
      case "goldenFishCrowned": {
        const guardian = this.match.guardian(event.id);
        if (guardian) {
          this.crownView?.destroy();
          this.crownView = new GoldenCrownView(this, guardian.x, guardian.y, getSettings().reducedEffects);
        }
        this.showMessage(`${GUARDIANS[event.guardianId].name} foi coroado! ${event.summary}`, 3600);
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
    // Quem cada bloqueador está segurando: o primeiro preso serve para decidir o lado do sprite.
    const blocked = new Map<string, Vec2>();
    for (const enemy of this.match.enemies) {
      if (!enemy.blockedById || enemy.dead || blocked.has(enemy.blockedById)) continue;
      blocked.set(enemy.blockedById, { x: enemy.x, y: enemy.y });
    }
    const blockedPosition = (guardianId: string): Vec2 | null => blocked.get(guardianId) ?? null;
    for (const view of this.enemyViews.values()) view.sync(now, deltaMs);
    for (const view of this.weakPointViews.values()) view.sync(deltaMs);
    for (const view of this.guardianViews.values()) view.sync(now, enemyPosition, blockedPosition);
    this.goldenBadge?.sync(deltaMs);
    if (this.crownView) {
      const crowned = this.match.crownedGuardianId ? this.match.guardian(this.match.crownedGuardianId) : null;
      if (crowned) this.crownView.sync(crowned.x, crowned.y, deltaMs);
      else {
        // A unidade coroada foi vendida: a coroa some com ela, e o Peixinho não volta.
        this.crownView.destroy();
        this.crownView = null;
      }
    }
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
    EventBus.on(Events.beginGuardianDrag, this.beginGuardianDrag, this);
    EventBus.on(Events.cancelCardSelection, this.cancelCardSelection, this);
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
    this.input.on("pointerup", this.handleWorldPointerUp, this);
    // ESC desfaz a seleção; sem nada selecionado, abre o menu de pause.
    this.input.keyboard?.on("keydown-ESC", this.handleEscape, this);
    // 1 a 5 escolhem a carta daquela vaga do esquadrão — a mesma ação do clique na carta, incluindo
    // apertar de novo para largar. Só no teclado: o celular continua no toque.
    this.input.keyboard?.on("keydown", this.handleSlotKey, this);
    // O menu do navegador no botão direito atrapalha o cancelamento por clique.
    this.game.canvas.addEventListener("contextmenu", preventContextMenu);

    // Cada limpeza entra nomeada no registro: o `destroyGame` roda todas em ordem inversa e isola
    // cada uma, então uma que estoure não impede as seguintes de rodar.
    this.disposables.add("eventos do HUD", () => {
      EventBus.off(Events.selectGuardian, this.selectGuardian, this);
      EventBus.off(Events.beginGuardianDrag, this.beginGuardianDrag, this);
      EventBus.off(Events.cancelCardSelection, this.cancelCardSelection, this);
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
    });
    this.disposables.add("input do mundo", () => {
      this.input.off("pointermove", this.handleWorldPointerMove, this);
      this.input.off("pointerdown", this.handleWorldPointerDown, this);
      this.input.off("pointerup", this.handleWorldPointerUp, this);
      this.input.keyboard?.off("keydown-ESC", this.handleEscape, this);
      this.input.keyboard?.off("keydown", this.handleSlotKey, this);
    });
    this.disposables.add("listeners do canvas", () => {
      this.game.canvas.removeEventListener("contextmenu", preventContextMenu);
      this.game.canvas.removeEventListener("pointerdown", this.unlockAudio);
    });
    this.disposables.add("motor", () => this.match.setListener(null));
    this.disposables.add("fantasma de posicionamento", () => this.ghost.destroy());
    this.disposables.add("efeitos", () => this.effects.destroy());
    this.disposables.add("áudio", () => this.audio.destroy());
    this.disposables.add("overlay de debug", () => this.debugOverlay.destroy());
  }

  /**
   * Atalhos 1–5: uma tecla por vaga do esquadrão, na MESMA ordem das cartas do HUD.
   *
   * Aceita a fileira de números e o teclado numérico. Ignora quando o jogador está digitando em
   * algum campo (a tela de conta tem um), senão escrever "guardiao1" viraria uma compra.
   */
  private handleSlotKey(event: KeyboardEvent): void {
    if (this.match.status !== "running") return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const slot = Number.parseInt(event.key, 10);
    if (!Number.isInteger(slot) || slot < 1 || slot > this.loadout.length) return;
    event.preventDefault();
    this.selectGuardian(this.loadout[slot - 1]);
  }

  private selectGuardian(id: GuardianId): void {
    if (this.match.status !== "running") return;
    this.selectedGuardianId = this.selectedGuardianId === id ? null : id;
    this.selectedPlacedGuardianId = null;
    this.ghost.setGuardian(this.selectedGuardianId ? GUARDIANS[this.selectedGuardianId] : null);
    if (this.selectedGuardianId) {
      const definition = GUARDIANS[id];
      this.showMessage(`Toque em ${placementModesOf(definition).map((mode) => PLACEMENT_HINTS[mode]).join(" ou ")} para posicionar ${definition.name}.`, 2200);
    }
    this.emitHud();
    this.renderPlacementState();
  }

  /**
   * O jogador apertou uma carta. A partir daqui, SOLTAR dentro do mapa posiciona — é o arraste.
   *
   * A janela só abre se a carta ficou de fato selecionada: apertar a carta que já estava escolhida a
   * larga (`selectGuardian` alterna), e nesse caso soltar não pode posicionar nada.
   */
  private beginGuardianDrag(id: GuardianId): void {
    this.dragPlacing = this.selectedGuardianId === id;
  }

  /** Larga só a carta escolhida; o Guardião posicionado em foco continua onde estava. */
  private cancelCardSelection(): void {
    if (!this.selectedGuardianId) return;
    this.selectedGuardianId = null;
    this.dragPlacing = false;
    this.ghost.setGuardian(null);
    this.ghost.hide();
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
    if (!placementModesOf(definition).includes("platform")) {
      this.showMessage(`${definition.name} precisa de ${placementModesOf(definition).map((mode) => PLACEMENT_HINTS[mode]).join(" ou ")}.`, 1900);
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

  /**
   * Põe o Peixinho no canto inferior direito. Arrastar é a única forma de coroar: soltar em cima de um
   * Guardião gasta o Peixinho, soltar no vazio traz ele de volta para o canto.
   */
  private spawnGoldenBadge(): void {
    this.goldenBadge?.destroy();
    this.goldenBadge = new GoldenFishBadge(this, {
      guardianAt: (x, y) => {
        // Raio generoso: a coroa é para o Guardião que o jogador MIROU, não para o pixel exato.
        const hit = this.match.guardians
          .map((guardian) => ({ guardian, distance: Math.hypot(guardian.x - x, guardian.y - y) }))
          .filter((entry) => entry.distance <= 52)
          .sort((first, second) => first.distance - second.distance)[0];
        return hit ? { id: hit.guardian.id, x: hit.guardian.x, y: hit.guardian.y } : null;
      },
      crown: (instanceId) => {
        const result = this.match.execute({ type: "crownGuardian", instanceId });
        if (!result.ok) {
          this.showMessage(result.message, 1800);
          return false;
        }
        this.goldenBadge = null;
        return true;
      },
      // Enquanto o peixinho está na mão, nenhuma carta de Guardião fica selecionada por engano.
      onDragStateChanged: (dragging) => {
        if (!dragging) return;
        this.selectedGuardianId = null;
        this.ghost.hide();
        this.renderPlacementState();
      },
    });
  }

  private clearPlacedSelection(): void {
    this.selectedPlacedGuardianId = null;
    this.emitHud();
    this.renderPlacementState();
  }

  private handleWorldPointerDown(pointer: Phaser.Input.Pointer): void {
    // Um clique que começa no mapa nunca é arraste de carta: fecha a janela antes de qualquer coisa,
    // senão o `pointerup` deste mesmo clique tentaria posicionar um SEGUNDO Guardião no lugar.
    this.dragPlacing = false;
    if (this.match.status !== "running" || pointer.y <= HUD_TOP || pointer.y >= GAME_HEIGHT - HUD_BOTTOM) return;
    if (pointer.rightButtonDown()) {
      this.cancelPlacement();
      return;
    }
    if (!this.selectedGuardianId) {
      if (this.selectedPlacedGuardianId) this.clearPlacedSelection();
      return;
    }
    // O `pointerdown` do Phaser chega ANTES do `dragstart`: sem esta guarda, pegar o Peixinho com uma
    // carta na mão posicionaria um Guardião embaixo dele.
    if (this.goldenBadge?.contains(pointer.worldX, pointer.worldY)) return;
    const definition = GUARDIANS[this.selectedGuardianId];
    if (freeModesOf(definition).length === 0) return;
    this.dropOnField(definition, pointer.worldX, pointer.worldY);
  }

  /**
   * Fim de um arraste: o jogador apertou a carta, trouxe até aqui e soltou.
   *
   * Conviver com o clique-clique de antes é o que exige a janela `dragPlacing`. Escolher a carta é um
   * `pointerdown` + `pointerup` em cima do menu, e posicionar é um `pointerdown` no mapa: se todo
   * `pointerup` dentro do mapa posicionasse, o clique de posicionar colocaria dois Guardiões (um na
   * descida, outro na subida). Por isso só solta quem começou numa carta, e um `pointerdown` no mapa
   * fecha a janela. Soltar ainda em cima do menu não faz nada: é o clique de escolher, como sempre foi.
   */
  private handleWorldPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragPlacing) return;
    this.dragPlacing = false;
    if (!this.selectedGuardianId || this.match.status !== "running") return;
    if (pointer.y <= HUD_TOP || pointer.y >= GAME_HEIGHT - HUD_BOTTOM) return;
    const definition = GUARDIANS[this.selectedGuardianId];
    if (placementModesOf(definition).includes("platform")) {
      const platform = this.platformNear(pointer.worldX, pointer.worldY);
      if (platform) {
        this.handlePlatform(platform);
        return;
      }
      // Fora de qualquer plataforma o arraste só vale para quem TAMBÉM aceita toque livre (o Polvo);
      // para os demais a carta continua na mão, sem obrigar a escolher tudo de novo.
      if (freeModesOf(definition).length === 0) return;
    }
    this.dropOnField(definition, pointer.worldX, pointer.worldY);
  }

  /** Posiciona fora de plataforma (rota, margem, água livre) e conta o que aconteceu. */
  private dropOnField(definition: GuardianDefinition, x: number, y: number): void {
    const result = this.place(definition.id, x, y);
    if (!result.ok) return;
    const guardian = this.match.guardian(result.instanceId ?? "");
    if (guardian?.platformId) {
      this.showMessage(`${definition.name} na plataforma de pedra.`, 1500);
      return;
    }
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

    const freeModes = freeModesOf(definition);
    if (placementModesOf(definition).includes("platform")) {
      // Na plataforma o fantasma encaixa no centro dela; longe de qualquer uma, segue o cursor em recusa.
      const platform = this.platformNear(pointer.worldX, pointer.worldY);
      const occupied = platform ? this.match.platformOccupant(platform.definition.id) !== null : false;
      if (platform || freeModes.length === 0) {
        this.ghost.show({
          x: platform?.definition.x ?? pointer.worldX,
          y: platform?.definition.y ?? pointer.worldY,
          valid: Boolean(platform) && !occupied,
          affordable,
          label: !platform ? "Precisa de uma plataforma" : occupied ? "Plataforma ocupada" : affordable ? cost : "Pérolas insuficientes",
        });
        return;
      }
    }

    const validation = validateAnyPlacement(freeModes, this.match.placementContext(), { x: pointer.worldX, y: pointer.worldY });
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
    this.dragPlacing = false;
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
    this.lifecycle.transition("finished");
    this.publishLifecycle();
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
      onPlayEncounter: (encounter: EncounterDefinition) => {
        host.clear();
        this.openEncounter(encounter.id);
      },
    };
    // O convite só aparece na vitória de uma fase de campanha que abriu um Encontro ainda pendente.
    const invite = outcome.victory && outcome.counted ? pendingEncounterFor(this.level.id, getProgression().progress.completedEncounters) : null;
    const screen = outcome.victory
      ? victoryScreen(result, outcome, this.level.name, actions, invite)
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
    this.pauseGame(paused);
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
    this.resetGame();
  }

  private startLevel(levelId: string): void {
    if (!getLevel(levelId)) return;
    this.resetGame(levelId);
  }

  private openLevelSelect(prepareLevelId?: string): void {
    lifecycleLog("match", "exit", { to: "LevelSelectScene" });
    transitionTo(this, "LevelSelectScene", prepareLevelId ? { prepareLevelId } : undefined);
  }

  /** Vai direto para a preparação de um Encontro (o convite da tela de vitória). */
  private openEncounter(encounterId: string): void {
    lifecycleLog("match", "exit", { to: "LevelSelectScene" });
    transitionTo(this, "LevelSelectScene", { prepareEncounterId: encounterId });
  }

  /** Sair pelo pause é ir para casa: o Meu Recife. Vencer continua levando ao mapa, para encadear. */
  private openHub(): void {
    lifecycleLog("match", "exit", { to: "HubScene" });
    transitionTo(this, "HubScene");
  }

  /**
   * Invariante de input: fora de uma transição, com nenhuma tela HTML aberta, o jogo TEM que estar
   * aceitando cliques. Quando isso deixa de valer, o jogo fica visualmente vivo e completamente
   * surdo — o sintoma mais difícil de diagnosticar que este projeto teve, porque não gera erro.
   *
   * A cura é pontual e barulhenta: restaura a invariante, registra o que aconteceu e despeja as
   * últimas fases. Não recarrega nada, não engole exceção, e só roda com diagnóstico ligado.
   */
  private checkInputWatchdog(delta: number): void {
    if (!DIAGNOSTICS_ON) return;
    this.watchdogAccumulatorMs += delta;
    if (this.watchdogAccumulatorMs < 1000) return;
    this.watchdogAccumulatorMs = 0;
    const host = getScreenHost(this.game);
    const transitioning = this.game.canvas.dataset.transition === "out";
    if (this.game.input.enabled || host.isOpen || transitioning) return;
    devAssert(false, "input do jogo desligado sem nenhuma tela aberta — restaurando", {
      phase: this.lifecycle.phase,
      overlay: this.game.canvas.dataset.overlay,
    });
    this.game.input.enabled = true;
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
            weakPoints: snapshot.boss.weakPoints,
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
    // Carta na mão (vazio = nenhuma). Sonda de dois gestos: soltar a carta dentro do mapa posiciona,
    // e descer de volta ao menu larga a carta.
    dataset.card = this.selectedGuardianId ?? "";
    dataset.selectedBranch = selected?.branchId ?? "";
    dataset.selectedOptions = selected ? String(selected.options.length) : "";
    dataset.selectedVariant = selectedView?.artVariantFolder ?? "";
    dataset.sellValue = selected ? String(selected.sellValueAt(ECONOMY.sellRefundRate)) : "";
    dataset.loadout = this.loadout.join(",");
    dataset.debug = String(this.debugFlags.enabled);
    dataset.paused = String(this.clock.paused);
    dataset.muted = String(this.audio.isMuted);
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
    // Sonda do item 15: com inimigo no alcance, isto TEM que passar por "idle" entre os golpes.
    dataset.shrimpState = shrimp?.currentVisualState ?? "";
    // Sonda do item 9: o Camarão está parado num posto, então isto só muda se ele virar para o alvo.
    dataset.shrimpFacing = shrimp ? (shrimp.facingLeftNow ? "left" : "right") : "";
    const weakPoints = this.match.snapshot().boss?.weakPoints;
    dataset.bossWeakPoints = weakPoints ? `${weakPoints.remaining}/${weakPoints.total}` : "";
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
      this.match.currentAmplified,
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
    this.marginBandTexture?.setVisible(false);
    const selected = this.selectedPlacedGuardianId ? this.match.guardian(this.selectedPlacedGuardianId) : undefined;
    if (selected) {
      const color = selected.branch?.color ?? selected.definition.accent;
      this.selectionGraphic.fillStyle(color, 0.06);
      this.selectionGraphic.fillCircle(selected.x, selected.y, selected.range);
      this.selectionGraphic.lineStyle(2, color, 0.8);
      this.selectionGraphic.strokeCircle(selected.x, selected.y, selected.range);
    }

    // V3.1: o guia mostra TODOS os lugares aceitos ao mesmo tempo — o Polvo acende as pedras e a
    // água, o Golfinho acende a faixa da margem. Quem aceita um lugar só continua exatamente igual.
    const modes = this.selectedGuardianId ? placementModesOf(GUARDIANS[this.selectedGuardianId]) : null;
    if (modes === null) {
      this.ghost.hide();
    } else {
      if (modes.includes("platform")) {
        this.platforms.forEach((platform) => {
          const occupied = this.match.platformOccupant(platform.definition.id) !== null;
          this.placementGuideGraphic.lineStyle(2, occupied ? 0xff8290 : 0xa5f6d2, occupied ? 0.42 : 0.72);
          this.placementGuideGraphic.strokeCircle(platform.definition.x, platform.definition.y, 38);
        });
      }
      if (modes.includes("margin")) this.marginBand().setVisible(true);
    }
    // Nada de `renderDebug()` aqui. São três camadas diferentes e elas não podem se misturar:
    //
    //   (a) nós internos da rota  → só com o overlay E a flag `routeNodes` ligados;
    //   (b) alcance e guia de posicionamento (o que este método desenha) → sempre que o jogador
    //       seleciona um Guardião, porque é informação legítima de jogo;
    //   (c) overlay de debug → só com `debugFlags.enabled`, repintado pelo acumulador do `update`.
    //
    // Este método é chamado por sete caminhos de seleção/venda/evolução. Enquanto ele repintava o
    // overlay, SELECIONAR UM GUARDIÃO era o gatilho visível dos cones na pista — e ainda recriava
    // um `Phaser.Text` por waypoint a cada clique.
  }

  /**
   * Faixa onde o Tubarão pode ficar: a beira da correnteza, entre `marginMin` e `marginMax` da rota.
   *
   * Ela é uma TEXTURA, e não dois traços translúcidos por cima do mapa, por causa de como o Phaser
   * desenha linha grossa: cada segmento vira um quadrilátero, e em cada curva da rota dois
   * quadriláteros se sobrepõem. Com alfa menor que 1, a sobreposição soma duas vezes e cada curva do
   * caminho ganhava uma cunha mais escura — a faixa parecia manchada exatamente onde o jogador mais
   * olha. Aqui a rota é pintada OPACA numa textura à parte, o miolo proibido é apagado com
   * `erase` (e não coberto por uma segunda camada escura, que era a outra fonte de escurecimento), e
   * só no fim a textura inteira entra na tela com um alfa único. Resultado: uma cor só, chapada, do
   * começo ao fim do caminho.
   */
  private marginBand(): Phaser.GameObjects.RenderTexture {
    if (this.marginBandTexture) return this.marginBandTexture;
    const texture = this.add.renderTexture(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0, 0).setDepth(DEPTH.effects - 1);
    const painter = this.make.graphics({ x: 0, y: 0 }, false);
    painter.lineStyle(PLACEMENT.marginMax * 2, MARGIN_BAND_COLOR, 1);
    this.strokeRoute(painter);
    texture.draw(painter);
    painter.clear();
    painter.lineStyle(PLACEMENT.marginMin * 2, 0xffffff, 1);
    this.strokeRoute(painter);
    texture.erase(painter);
    painter.destroy();
    texture.setAlpha(MARGIN_BAND_ALPHA).setVisible(false);
    this.marginBandTexture = texture;
    this.disposables.add("faixa da margem", () => {
      this.marginBandTexture?.destroy();
      this.marginBandTexture = null;
    });
    return texture;
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
    // A maré grossa da Baleia não muda o SENTIDO das partículas: acelera o que já corria, que é
    // exatamente o que o jogador sente na rota.
    const amplified = this.match.currentAmplified;
    const rush = amplified ? BOSS_CURRENT.strengthMultiplier : 1;
    this.currentMotes.forEach(({ mote, zoneIndex }, index) => {
      const zone = this.level.currents[zoneIndex];
      const length = Math.hypot(zone.direction.x, zone.direction.y) || 1;
      const speed = (22 + (index % 4) * 8) * rush;
      mote.x += (zone.direction.x / length) * speed * (deltaMs / 1000);
      mote.y += (zone.direction.y / length) * speed * (deltaMs / 1000);
      if (mote.x > zone.x + zone.width) mote.x = zone.x;
      if (mote.x < zone.x) mote.x = zone.x + zone.width;
      if (mote.y > zone.y + zone.height) mote.y = zone.y;
      if (mote.y < zone.y) mote.y = zone.y + zone.height;
      mote.setFillStyle(amplified ? 0xffd27a : 0xa4f5ff, amplified ? 0.5 : 0.36);
    });
  }
}
