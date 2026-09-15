import { ECONOMY, PLACEMENT } from "../../data/balance";
import { ENEMIES, scaleEnemy } from "../../data/enemies";
import { applyElite, ELITES, type EliteId } from "../../data/elites";
import { GUARDIANS } from "../../data/guardians";
import { goldenAwardWaveIndex, goldenBoostFor } from "../../data/goldenFish";
import type { EnemyId, GuardianDefinition, GuardianId, LevelDefinition, PlayerId, TeamId } from "../../types";
import { resolveAura, type AuraSource } from "../Auras";
import { BlockingSystem } from "../Blocking";
import { BossEncounter, type BossEncounterEvent } from "../BossEncounter";
import { controlTier } from "../CrowdControl";
import { CurrentSystem, zoneFromFlowField } from "../CurrentSystem";
import { InteractableSystem, type InteractableRuntime } from "../Interactables";
import { Economy, type PearlSink, type PearlSource } from "../Economy";
import { EnemyAbilitySystem, type EnemyAbilityEvent, type EnemyAbilityWorld } from "../EnemyAbilities";
import type { FlowField } from "../FlowField";
import {
  flowFieldsFor,
  updateChorus,
  updateFrenzy,
  updateMark,
  updatePushWave,
  updateIncome,
  updateSonar,
  updateTrap,
  type BehaviorHooks,
  type DamageOptions,
} from "../GuardianBehaviors";
import { validatePlacement, type PlacementContext } from "../PlacementRules";
import { createRng, type Rng } from "../Rng";
import { RoutePath } from "../RoutePath";
import { MAIN_PATH_ID, resolveLevelPaths } from "../WaveDefinitions";
import { wavePreview, type WavePreview } from "../WavePreview";
import { WaveScheduler } from "../WaveScheduler";
import { ALLY_PLAYER_ID, DEFAULT_PLAYER_ID, type CommandResult, type MatchCommand } from "./MatchCommands";
import { MatchEnemy } from "./MatchEnemy";
import type { MatchEvent, MatchListener } from "./MatchEvents";
import { MatchGuardian, type GuardianPlacement } from "./MatchGuardian";
import type { MatchSnapshot, MatchStatus } from "./MatchSnapshot";
import { MatchStats } from "./MatchStats";
import { AreaEffects } from "./systems/AreaEffects";
import { resolveAttack } from "./systems/CombatSystem";
import { MatchWeakPoint } from "./MatchWeakPoint";
import { weakPointBurstDamage, weakPointDefinition } from "../WeakPoints";
import { ProjectileSystem } from "./systems/ProjectileSystem";

export interface PlayerConfig {
  id: PlayerId;
  teamId: TeamId;
}

/** Quem age dentro do tick, logo após o relógio avançar (roteiro de balanceamento, IA, replay). */
export interface MatchController {
  act(match: Match): void;
}

export interface MatchOptions {
  /** Passo fixo da simulação. */
  dtMs?: number;
  /** Começa direto em uma onda (atalho de debug `?wave=`). */
  startWaveIndex?: number;
  seed?: number | string;
  players?: PlayerConfig[];
  controller?: MatchController | null;
  /**
   * Como as pérolas são divididas no coop (item 47). `shared` (padrão) é o jogo de hoje: um caixa só.
   * `individual` dá um caixa por jogador; cada um paga o que coloca e recebe a própria parte.
   */
  economyMode?: "shared" | "individual";
  /**
   * Maestria permanente por espécie, vinda do save (V3). O motor não conhece Conchas nem tela de
   * menu: recebe os níveis prontos, como já recebe a fase e a dificuldade resolvidas.
   */
  masteryLevels?: Partial<Record<GuardianId, number>>;
}

/** Chave do caixa único no modo compartilhado. */
const SHARED_WALLET: PlayerId = "shared";

/** Ganhos que pertencem à mesa inteira: no modo individual, todo jogador recebe. */
const SHARED_SOURCES: PearlSource[] = ["EnemyReward", "WaveReward", "LevelReward", "MapReward", "SpecialReward", "EarlyWaveBonus"];

interface RouteUnit {
  x: number;
  y: number;
  guardianId: string;
}

/**
 * Motor único da partida (item 43): estado + regras, sem Phaser. Mutação só por `execute(command)`;
 * observação por `snapshot()`, pelas listas de entidades (read views) e pelos eventos do `listener`.
 * A `GameScene` é apenas apresentação em cima dele; `simulateLevel` o roda headless.
 */
export class Match {
  readonly dtMs: number;
  readonly rng: Rng;
  readonly stats = new MatchStats();
  /** Rota principal (compatibilidade); todas as rotas ficam em `routes`. */
  readonly route: RoutePath;
  readonly routes: ReadonlyMap<string, RoutePath>;
  /** Um caixa no modo compartilhado; um por jogador no individual. */
  private readonly economies = new Map<PlayerId, Economy>();
  readonly economyMode: "shared" | "individual";
  private readonly scheduler: WaveScheduler;
  private readonly enemyList: MatchEnemy[] = [];
  /**
   * Pontos fracos de chefe. Ficam FORA de `enemyList` de propósito (item 11): é a lista de
   * inimigos que alimenta a contagem de vitória, o dano ao Recife, o bloqueio e a recompensa de
   * abate. Mantê-los fora dela resolve tudo isso de uma vez, sem espalhar exceções.
   */
  private readonly weakPointList: MatchWeakPoint[] = [];
  /** `enemyList` + pontos fracos: o que pode ser MIRADO e ATINGIDO. Só aloca quando há pontos. */
  private targetPool: readonly MatchEnemy[] = [];
  private weakPointSerial = 0;
  private readonly guardianList: MatchGuardian[] = [];
  private readonly projectileSystem = new ProjectileSystem();
  private readonly areas = new AreaEffects();
  private readonly blocking = new BlockingSystem();
  private readonly abilitySystem = new EnemyAbilitySystem<MatchEnemy>();
  private readonly bossEncounter = new BossEncounter<MatchEnemy>();
  private readonly routeUnits: RouteUnit[] = [];
  private readonly platformOccupants = new Map<string, string>();
  /** Elementos do mapa com que o jogador interage (item 28); vazio nas fases sem nenhum. */
  readonly interactables: InteractableSystem;
  private readonly players: PlayerConfig[];
  private readonly controller: MatchController | null;
  private readonly masteryLevels: Partial<Record<GuardianId, number>>;
  /** Peixinho Dourado: já foi concedido nesta partida? */
  private goldenAwarded = false;
  /** Instância coroada; `null` enquanto o jogador não escolhe. */
  private goldenGuardianId: string | null = null;
  readonly currents: CurrentSystem;
  private reefValue: number;
  private statusValue: MatchStatus = "running";
  private nowMs = 0;
  private enemySerial = 0;
  private guardianSerial = 0;
  private listener: MatchListener | null = null;
  /** Debug: o Recife não perde vidas. */
  private invincible = false;

  constructor(
    readonly level: LevelDefinition,
    options: MatchOptions = {},
  ) {
    this.dtMs = options.dtMs ?? 1000 / 60;
    this.rng = createRng(options.seed ?? level.id);
    this.players = options.players ?? [{ id: DEFAULT_PLAYER_ID, teamId: "t1" }];
    this.interactables = new InteractableSystem(level.interactables ?? []);
    this.controller = options.controller ?? null;
    this.masteryLevels = options.masteryLevels ?? {};
    const paths = resolveLevelPaths(level);
    this.routes = new Map(paths.map((path) => [path.id, new RoutePath(path.waypoints)]));
    this.route = this.routes.get(paths[0].id) as RoutePath;
    this.economyMode = options.economyMode ?? "shared";
    if (this.economyMode === "individual") {
      // Cada jogador começa com o caixa cheio: a fase não fica mais pobre por ter mais gente.
      for (const player of this.players) this.economies.set(player.id, new Economy(level.startingPearls));
    } else {
      this.economies.set(SHARED_WALLET, new Economy(level.startingPearls));
    }
    this.scheduler = new WaveScheduler(level.waves, level.initialWaveDelayMs, level.betweenWaveDelayMs, options.startWaveIndex ?? 0);
    this.currents = CurrentSystem.fromLevel(level.currents);
    this.reefValue = level.reefHealth;
    this.stats.totalWaves = level.waves.length;
  }

  // ----------------------------------------------------------------- leitura

  get now(): number {
    return this.nowMs;
  }

  get status(): MatchStatus {
    return this.statusValue;
  }

  get reef(): number {
    return this.reefValue;
  }

  get weakPoints(): readonly MatchWeakPoint[] {
    return this.weakPointList;
  }

  get enemies(): readonly MatchEnemy[] {
    return this.enemyList;
  }

  get guardians(): readonly MatchGuardian[] {
    return this.guardianList;
  }

  get projectiles() {
    return this.projectileSystem.projectiles;
  }

  get fields() {
    return this.areas.fields;
  }

  get clouds() {
    return this.areas.clouds;
  }

  get flowFields(): readonly FlowField[] {
    return this.currents.flowFields;
  }

  get currentAmplified(): boolean {
    return this.currents.amplified;
  }

  get playerIds(): readonly PlayerId[] {
    return this.players.map((player) => player.id);
  }

  pearls(playerId: PlayerId = DEFAULT_PLAYER_ID): number {
    return this.walletOf(playerId).pearls;
  }

  economySnapshot(playerId: PlayerId = DEFAULT_PLAYER_ID) {
    return this.walletOf(playerId).snapshot();
  }

  /** Caixa de um jogador: o compartilhado quando o modo é `shared`. */
  private walletOf(playerId: PlayerId): Economy {
    if (this.economyMode === "shared") return this.economies.get(SHARED_WALLET) as Economy;
    const wallet = this.economies.get(playerId);
    if (wallet) return wallet;
    const created = new Economy(this.level.startingPearls);
    this.economies.set(playerId, created);
    return created;
  }

  guardian(id: string): MatchGuardian | undefined {
    return this.guardianList.find((guardian) => guardian.id === id);
  }

  enemy(id: string): MatchEnemy | undefined {
    return this.enemyList.find((enemy) => enemy.id === id);
  }

  platformOccupant(platformId: string): string | null {
    return this.platformOccupants.get(platformId) ?? null;
  }

  /** Bloqueadores em cima da rota (para o overlay de debug). */
  get routeOccupants(): readonly RouteUnit[] {
    return this.routeUnits;
  }

  heldSince(blockerId: string, enemyId: string): number | null {
    return this.blocking.heldSince(blockerId, enemyId);
  }

  /** Debug: elimina todos os inimigos em campo, sem pagar recompensa. */
  private killAll(): void {
    for (const enemy of [...this.enemyList]) {
      if (enemy.dead || enemy.reachedGoal) continue;
      enemy.dead = true;
      // O chefe some e leva os pontos fracos presos a ele; senão ficariam órfãos em campo.
      this.removeWeakPointsOf(enemy.id);
      this.abilitySystem.died(enemy, this.abilityWorld());
      this.bossEncounter.onRemoved(enemy);
      this.emit({ type: "enemyKilled", now: this.nowMs, id: enemy.id, enemyId: enemy.definition.id, x: enemy.x, y: enemy.y, reward: 0, killerId: null });
    }
  }

  /** Debug: fere um alvo pelo caminho normal de dano (serve para inimigo e para ponto fraco). */
  private debugDamage(targetId: string, amount: number): void {
    const target = this.enemyList.find((enemy) => enemy.id === targetId) ?? this.weakPointList.find((point) => point.id === targetId);
    if (!target) return;
    this.damage(target, Math.max(0, amount), { cause: "melee" });
  }

  /** Composição da próxima onda para o HUD (null na última). */
  nextWavePreview(): WavePreview | null {
    return wavePreview(this.scheduler.upcomingWave);
  }

  /** Contexto puro para a apresentação pré-validar um ponto (preview) sem mutar nada. */
  placementContext(): PlacementContext {
    return {
      route: this.route,
      platforms: this.level.placements,
      guardians: this.guardianList,
      routeUnits: this.routeUnits,
    };
  }

  setListener(listener: MatchListener | null): void {
    this.listener = listener;
  }

  /** Estado para a apresentação. No coop, cada jogador pede o seu (as pérolas mudam por jogador). */
  snapshot(playerId: PlayerId = DEFAULT_PLAYER_ID): MatchSnapshot {
    const bossState = this.bossEncounter.snapshot();
    const boss = bossState ? (this.enemy(bossState.id) ?? null) : null;
    const trap = this.guardianList.find((guardian) => guardian.trapPhase !== null);
    return {
      status: this.statusValue,
      now: this.nowMs,
      pearls: this.pearls(playerId),
      reef: this.reefValue,
      maxReef: this.level.reefHealth,
      wave: this.scheduler.currentWave,
      totalWaves: this.scheduler.totalWaves,
      waveState: this.scheduler.state,
      countdownSeconds: this.scheduler.countdownSeconds,
      canStartNextWave: this.statusValue === "running" && this.scheduler.state === "countdown",
      guardianCount: this.guardianList.length,
      upgradeCount: this.guardianList.reduce((total, guardian) => total + guardian.upgradeLevel, 0),
      aliveEnemies: this.enemyList.filter((enemy) => !enemy.dead && !enemy.reachedGoal).length,
      boss:
        boss && bossState
          ? {
              id: boss.id,
              name: boss.definition.name,
              title: bossState.title,
              x: boss.x,
              y: boss.y,
              speed: boss.effectiveSpeed,
              health: boss.health,
              maxHealth: boss.definition.maxHealth,
              healthRatio: bossState.healthRatio,
              weakPoints: boss.definition.weakPoints
                ? {
                    total: boss.definition.weakPoints.count,
                    remaining: this.weakPointList.filter((point) => point.parent.id === boss.id && !point.dead).length,
                  }
                : null,
              phaseIndex: bossState.phaseIndex,
              phaseCount: bossState.phaseCount,
              blockedById: boss.blockedById,
            }
          : null,
      nextWave: this.nextWavePreview(),
      trapPhase: trap?.trapPhase ?? null,
      interactables: this.interactables.states().map((runtime) => ({
        id: runtime.definition.id,
        label: runtime.definition.label,
        x: runtime.definition.x,
        y: runtime.definition.y,
        radius: InteractableSystem.radiusOf(runtime.definition),
        state: runtime.state,
        progress: runtime.progress,
        tappable: runtime.definition.goal.type === "taps" || runtime.definition.goal.type === "reveal",
        hint: this.interactableHint(runtime),
      })),
      stats: this.stats.snapshot(this.economySnapshot(playerId)),
    };
  }


  // ------------------------------------------------------- interagíveis do mapa

  /** Toque do jogador em um elemento do mapa (item 28). */
  private interact(command: Extract<MatchCommand, { type: "interact" }>): CommandResult {
    const result = this.interactables.interact(command.interactableId, this.nowMs);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        notFound: "Nada para fazer aqui.",
        locked: "Ainda não dá para mexer nisso.",
        cooldown: "Espere um instante antes de tentar de novo.",
        done: "Já está resolvido.",
        notTappable: "Isto não se resolve com toques.",
      };
      const reason = result.reason === "cooldown" ? "interactableBusy" : result.reason === "done" ? "interactableDone" : result.reason === "locked" ? "interactableLocked" : "notFound";
      return { ok: false, reason, message: messages[result.reason] };
    }
    const runtime = this.interactables.get(command.interactableId);
    if (runtime && !result.completed) {
      this.emit({
        type: "interactableProgress",
        now: this.nowMs,
        id: runtime.definition.id,
        progress: result.progress,
        label: runtime.definition.label,
        x: runtime.definition.x,
        y: runtime.definition.y,
      });
    }
    if (runtime && result.completed) this.resolveInteractable(runtime);
    return { ok: true, progress: result.progress, completed: result.completed };
  }

  /** Paga o que o interagível prometia: aliado, corrente temporária, segredo. */
  private resolveInteractable(runtime: InteractableRuntime): void {
    const definition = runtime.definition;
    this.emit({
      type: "interactableCompleted",
      now: this.nowMs,
      id: definition.id,
      label: definition.label,
      x: definition.x,
      y: definition.y,
      secretId: definition.secretId ?? null,
    });
    if (definition.secretId) this.stats.recordSecret(definition.secretId);
    this.stats.recordInteractable(definition.id);
    if (definition.current) {
      // Corrente temporária: a água muda de ideia por alguns segundos (a Tartaruga saindo da rede).
      this.currents.addTemporary({
        id: `interact:${definition.id}`,
        ownerId: null,
        origin: "interactable",
        shape: { kind: "circle", x: definition.current.x, y: definition.current.y, radius: definition.current.radius },
        direction: null,
        strength: definition.current.speedFactor,
        projectileDrift: 0,
        affects: ["enemy"],
        amplifiable: false,
        expiresAt: this.nowMs + definition.current.durationMs,
        respectsSlowResistance: true,
        visual: { kind: "ring", color: 0x8df3ff },
      });
    }
    if (definition.ally) this.spawnAlly(definition, definition.ally);
  }

  /**
   * Guardião libertado entra de graça e sem dono: o jogador sente a mecânica antes de tê-lo na
   * coleção. Não pode ser vendido nem evoluído (é emprestado, não comprado).
   */
  private spawnAlly(definition: InteractableRuntime["definition"], ally: NonNullable<InteractableRuntime["definition"]["ally"]>): void {
    const guardianDefinition: GuardianDefinition = GUARDIANS[ally.guardianId];
    const routeDistance = guardianDefinition.placementMode === "route" || guardianDefinition.placementMode === "margin" ? this.route.getClosestPoint(ally).routeDistance : null;
    const guardian = new MatchGuardian(`A${++this.guardianSerial}`, guardianDefinition, { x: ally.x, y: ally.y, routeDistance, platformId: null }, ALLY_PLAYER_ID, this.nowMs);
    for (let level = 0; level < (ally.upgradeLevel ?? 0); level += 1) guardian.applyUpgrade(ally.branchId ?? "a", this.nowMs);
    this.guardianList.push(guardian);
    if (routeDistance !== null) this.routeUnits.push({ x: guardian.x, y: guardian.y, guardianId: guardian.id });
    this.emit({ type: "allyJoined", now: this.nowMs, id: guardian.id, guardianId: guardianDefinition.id, x: guardian.x, y: guardian.y, label: definition.label });
  }

  /** Texto curto que a cena mostra ao lado do elemento. */
  private interactableHint(runtime: InteractableRuntime): string {
    const messages = runtime.definition.messages ?? {};
    if (runtime.state === "done") return messages.done ?? "Resolvido.";
    if (runtime.state === "locked") return messages.idle ?? "Ainda não.";
    if (runtime.progress > 0) return messages.progress ?? runtime.definition.label;
    return messages.idle ?? runtime.definition.label;
  }

  // ---------------------------------------------------------------- comandos

  /** Peixinho Dourado concedido (e ainda não usado). */
  get goldenFishAvailable(): boolean {
    return this.goldenAwarded && this.goldenGuardianId === null;
  }

  /** Unidade coroada nesta partida; `null` enquanto ninguém foi escolhido. */
  get crownedGuardianId(): string | null {
    return this.goldenGuardianId;
  }

  execute(command: MatchCommand): CommandResult {
    if (this.statusValue !== "running") return { ok: false, reason: "gameOver", message: "A partida terminou." };
    switch (command.type) {
      case "placeGuardian":
        return this.placeGuardian(command);
      case "upgradeGuardian":
        return this.upgradeGuardian(command);
      case "sellGuardian":
        return this.sellGuardian(command);
      case "startNextWave":
        return this.startNextWave();
      case "crownGuardian":
        return this.crownGuardian(command);
      case "interact":
        return this.interact(command);
      case "debug.damageEnemy":
        this.stats.cheated = true;
        this.debugDamage(command.enemyId, command.amount);
        return { ok: true };
      case "debug.addPearls":
        this.stats.cheated = true;
        this.earn(Math.max(0, command.amount), "SpecialReward", command.playerId ?? DEFAULT_PLAYER_ID);
        return { ok: true };
      case "debug.spawnEnemy":
        this.stats.cheated = true;
        this.spawnEnemy(command.enemyId, { pathId: MAIN_PATH_ID, pathDistance: 0 }, command.elite ?? null);
        return { ok: true };
      case "debug.skipWave":
        this.stats.cheated = true;
        this.scheduler.forceCompleteSpawns();
        this.killAll();
        return { ok: true };
      case "debug.killAll":
        this.stats.cheated = true;
        this.killAll();
        return { ok: true };
      case "debug.invincible":
        this.stats.cheated = true;
        this.invincible = command.on;
        return { ok: true };
      default: {
        const exhaustive: never = command;
        return { ok: false, reason: "unknownCommand", message: `Comando desconhecido: ${String((exhaustive as { type?: string }).type)}` };
      }
    }
  }

  private placeGuardian(command: Extract<MatchCommand, { type: "placeGuardian" }>): CommandResult {
    const definition: GuardianDefinition = GUARDIANS[command.guardianId];
    const playerId = command.playerId ?? DEFAULT_PLAYER_ID;
    if (!this.walletOf(playerId).canAfford(definition.cost)) {
      return { ok: false, reason: "insufficientPearls", message: `Faltam pérolas para ${definition.name}.` };
    }
    let placement: GuardianPlacement;
    if (definition.placementMode === "platform") {
      const platform = command.platformId
        ? this.level.placements.find((candidate) => candidate.id === command.platformId)
        : this.level.placements.find(
            (candidate) => !this.platformOccupants.has(candidate.id) && Math.hypot(candidate.x - command.x, candidate.y - command.y) <= PLACEMENT.platformHitRadius,
          );
      if (!platform) {
        return command.platformId
          ? { ok: false, reason: "notFound", message: "Plataforma desconhecida." }
          : { ok: false, reason: "noPlatformNear", message: `${definition.name} precisa de uma plataforma de pedra.` };
      }
      if (this.platformOccupants.has(platform.id)) return { ok: false, reason: "platformOccupied", message: "Plataforma ocupada." };
      placement = { x: platform.x, y: platform.y, routeDistance: null, platformId: platform.id };
    } else {
      if (command.platformId) return { ok: false, reason: "needsPlatform", message: `${definition.name} não fica em plataformas.` };
      const validation = validatePlacement(definition.placementMode, this.placementContext(), { x: command.x, y: command.y });
      if (!validation.valid) return { ok: false, reason: "invalidPlacement", message: validation.reason };
      placement = { x: validation.x, y: validation.y, routeDistance: validation.routeDistance, platformId: null };
    }

    this.spend(definition.cost, "Place", playerId);
    const guardian = new MatchGuardian(
      `G${++this.guardianSerial}`,
      definition,
      placement,
      playerId,
      this.nowMs,
      this.masteryLevels[definition.id] ?? 0,
    );
    this.guardianList.push(guardian);
    if (placement.platformId) this.platformOccupants.set(placement.platformId, guardian.id);
    if (placement.routeDistance !== null) this.routeUnits.push({ x: placement.x, y: placement.y, guardianId: guardian.id });
    this.stats.recordPlacement(definition.id, this.guardianList.length);
    this.emit({
      type: "guardianPlaced",
      now: this.nowMs,
      id: guardian.id,
      guardianId: definition.id,
      x: placement.x,
      y: placement.y,
      playerId,
      platformId: placement.platformId,
      cost: definition.cost,
    });
    return { ok: true, instanceId: guardian.id, cost: definition.cost };
  }

  private upgradeGuardian(command: Extract<MatchCommand, { type: "upgradeGuardian" }>): CommandResult {
    const guardian = this.guardian(command.instanceId);
    if (!guardian) return { ok: false, reason: "notFound", message: "Guardião não encontrado." };
    const option = guardian.options.find((candidate) => candidate.branchId === command.branchId);
    if (!option) {
      const locked = guardian.branchStatuses.find((status) => status.id === command.branchId);
      if (locked?.state === "locked") {
        return {
          ok: false,
          reason: "branchLocked",
          message: `Ramo ${locked.name} bloqueado: esta unidade seguiu ${guardian.branch?.name ?? "outro ramo"}.`,
        };
      }
      return { ok: false, reason: "noOption", message: "Nenhum upgrade disponível neste ramo." };
    }
    if (!this.walletOf(command.playerId ?? DEFAULT_PLAYER_ID).canAfford(option.cost)) {
      return { ok: false, reason: "insufficientPearls", message: "Pérolas insuficientes para este upgrade." };
    }
    if (!guardian.applyUpgrade(command.branchId, this.nowMs)) return { ok: false, reason: "noOption", message: "Upgrade indisponível." };
    this.spend(option.cost, "Upgrade", command.playerId ?? DEFAULT_PLAYER_ID);
    this.stats.recordUpgrade(guardian.upgradeLevel);
    this.emit({
      type: "guardianUpgraded",
      now: this.nowMs,
      id: guardian.id,
      guardianId: guardian.guardianId,
      branchId: command.branchId,
      level: guardian.upgradeLevel,
      optionName: option.name,
      branchName: option.branchName,
      cost: option.cost,
    });
    return { ok: true, instanceId: guardian.id, cost: option.cost };
  }

  /** Venda: devolve parte do investimento e limpa tudo que a unidade mantinha no mapa. */
  private sellGuardian(command: Extract<MatchCommand, { type: "sellGuardian" }>): CommandResult {
    const guardian = this.guardian(command.instanceId);
    if (!guardian) return { ok: false, reason: "notFound", message: "Guardião não encontrado." };
    // Aliado libertado é emprestado, não comprado: fica até o fim da partida e não rende pérolas.
    if (guardian.ownerId === ALLY_PLAYER_ID) return { ok: false, reason: "notOwner", message: "Este Guardião veio ajudar; não é seu para vender." };
    const refund = guardian.sellValueAt(ECONOMY.sellRefundRate);
    this.removeGuardian(guardian);
    this.earn(refund, "SellRefund", command.playerId ?? DEFAULT_PLAYER_ID);
    this.stats.guardiansSold += 1;
    this.emit({ type: "guardianSold", now: this.nowMs, id: guardian.id, guardianId: guardian.guardianId, refund });
    return { ok: true, instanceId: guardian.id, refund };
  }

  private removeGuardian(guardian: MatchGuardian): void {
    const index = this.guardianList.indexOf(guardian);
    if (index >= 0) this.guardianList.splice(index, 1);
    if (guardian.platformId) this.platformOccupants.delete(guardian.platformId);
    for (let unit = this.routeUnits.length - 1; unit >= 0; unit -= 1) {
      if (this.routeUnits[unit].guardianId === guardian.id) this.routeUnits.splice(unit, 1);
    }
    this.areas.removeOwner(guardian.id, this.nowMs, this.emitBound);
    this.currents.setOwnerZones(guardian.id, []);
    this.blocking.forget(guardian.id);
    for (const enemy of this.enemyList) {
      if (enemy.blockedById === guardian.id) enemy.clearBlocked();
      if (enemy.status.markedBy(this.nowMs) === guardian.id) enemy.status.clearMark();
    }
    // Regra herdada da cena: vender um Golfinho com sonar solta a coordenação de todos os aliados.
    if (guardian.runtime.sonar) {
      for (const other of this.guardianList) if (other.runtime.preferredTarget) other.runtime.preferredTarget = null;
    }
  }

  /**
   * Concede o Peixinho Dourado por volta de 60% da fase. É RECOMPENSA GARANTIDA, não sorteio: a mesma
   * fase entrega na mesma onda, sempre. Nunca na última, para dar tempo de usar a coroa.
   */
  private maybeAwardGoldenFish(waveIndex: number): void {
    if (this.goldenAwarded) return;
    if (waveIndex < goldenAwardWaveIndex(this.level.waves.length)) return;
    this.goldenAwarded = true;
    this.emit({ type: "goldenFishAwarded", now: this.nowMs, waveIndex });
  }

  /**
   * Coroa uma unidade. Um por partida e sem volta — é a decisão que o Peixinho existe para provocar.
   *
   * 🔶 A amplificação em si ainda não tem números (ver `data/goldenFish.ts`): o que já funciona é o
   * fluxo inteiro — concessão, escolha, marca na unidade e evento para a apresentação coroar.
   */
  private crownGuardian(command: { instanceId: string; playerId?: PlayerId }): CommandResult {
    if (!this.goldenAwarded) return { ok: false, reason: "goldenUnavailable", message: "O Peixinho Dourado ainda não apareceu." };
    if (this.goldenGuardianId !== null) return { ok: false, reason: "goldenSpent", message: "O Peixinho Dourado já escolheu um Guardião." };
    const guardian = this.guardianList.find((candidate) => candidate.id === command.instanceId);
    if (!guardian) return { ok: false, reason: "notFound", message: "Guardião não encontrado." };
    const playerId = command.playerId ?? DEFAULT_PLAYER_ID;
    if (guardian.ownerId !== playerId) return { ok: false, reason: "notOwner", message: "Este Guardião não é seu." };
    guardian.crown();
    this.goldenGuardianId = guardian.id;
    this.emit({
      type: "goldenFishCrowned",
      now: this.nowMs,
      id: guardian.id,
      guardianId: guardian.guardianId,
      branchId: guardian.branchId,
      summary: goldenBoostFor(guardian.guardianId, guardian.branchId).summary,
    });
    return { ok: true, instanceId: guardian.id };
  }

  private startNextWave(): CommandResult {
    if (this.scheduler.state !== "countdown") return { ok: false, reason: "notInCountdown", message: "A onda já está em curso." };
    const remainingMs = this.scheduler.countdownMs;
    if (!this.scheduler.skipCountdown()) return { ok: false, reason: "notInCountdown", message: "A onda já está em curso." };
    this.stats.earlyWaveCalls += 1;
    return { ok: true, earlyStartMs: remainingMs };
  }

  // -------------------------------------------------------------------- tick

  /** Um passo fixo de `dtMs`. Não faz nada depois da vitória ou derrota. */
  tick(): void {
    if (this.statusValue !== "running") return;
    const deltaMs = this.dtMs;
    this.nowMs += deltaMs;
    this.stats.timeMs = this.nowMs;
    this.controller?.act(this);
    // Habilidades de escopo de mundo (inversão de corrente do chefe) rodam antes das ondas, como antes.
    this.abilitySystem.worldTick(deltaMs, this.abilityWorld());

    // Um só array quando não há chefe com pontos fracos em campo: nada de alocar a 60Hz à toa.
    this.targetPool = this.weakPointList.length > 0 ? [...this.enemyList, ...this.weakPointList] : this.enemyList;

    const alive = this.enemyList.filter((enemy) => !enemy.dead && !enemy.reachedGoal).length;
    for (const event of this.scheduler.tick(deltaMs, alive)) {
      if (event.type === "spawn") {
        this.spawnEnemy(event.enemyId, { pathId: event.pathId, pathDistance: 0 }, event.eliteId);
      } else if (event.type === "waveStarted") {
        // Chamar a onda antes da hora rende pérolas por segundo poupado (taxa 0 = desligado).
        this.earn(Math.floor((event.earlyStartMs / 1000) * ECONOMY.earlyStartBonusPerSecond), "EarlyWaveBonus", DEFAULT_PLAYER_ID);
        this.emit({
          type: "waveStarted",
          now: this.nowMs,
          waveIndex: event.waveIndex,
          name: this.level.waves[event.waveIndex]?.name ?? "",
          isLast: event.waveIndex === this.level.waves.length - 1,
        });
      } else if (event.type === "waveCleared") {
        this.stats.wavesCompleted += 1;
        const bonus = this.earn(event.reward, "WaveReward", DEFAULT_PLAYER_ID);
        this.emit({ type: "waveCompleted", now: this.nowMs, waveIndex: event.waveIndex, bonus });
        this.maybeAwardGoldenFish(event.waveIndex);
      } else if (event.type === "victory") {
        const bonus = this.earn(this.level.levelClearBonus ?? ECONOMY.levelClearBonus, "LevelReward", DEFAULT_PLAYER_ID);
        this.statusValue = "victory";
        this.emit({ type: "levelCompleted", now: this.nowMs, bonus });
      }
    }

    this.currents.update(this.nowMs);
    this.syncGuardianCurrents();
    if (!this.interactables.isEmpty) {
      const finished = this.interactables.tick(this.nowMs, {
        wave: this.scheduler.currentWave,
        guardians: this.guardianList,
        deltaMs,
      });
      finished.forEach((runtime) => this.resolveInteractable(runtime));
    }
    this.blocking.update(this.guardianList, this.enemyList, this.nowMs, deltaMs, {
      damage: (enemy, amount) => this.damage(enemy, amount, { continuous: true, cause: "contact" }),
      onBossHeld: (blocker, enemy) => this.emit({ type: "enemyHeld", now: this.nowMs, blockerId: blocker.id, enemyId: enemy.id, x: enemy.x, y: enemy.y }),
      onReleased: (blocker, enemy) => this.emit({ type: "enemyReleased", now: this.nowMs, blockerId: blocker.id, enemyId: enemy.id, x: enemy.x, y: enemy.y }),
    });
    this.abilitySystem.tick(deltaMs, this.abilityWorld());
    for (const enemy of this.enemyList) {
      if (enemy.tick(this.nowMs, deltaMs, this.currents)) this.leak(enemy);
    }
    for (const weakPoint of this.weakPointList) weakPoint.tick(this.nowMs, deltaMs, this.currents);
    this.drainPoison();

    const hooks = this.behaviorHooks();
    for (const guardian of this.guardianList) {
      updateIncome(guardian, hooks);
      updateTrap(guardian, this.enemyList, hooks);
    }
    this.updateAuras();
    for (const guardian of this.guardianList) {
      guardian.syncStatus(this.nowMs);
      updateFrenzy(guardian, this.enemyList, this.nowMs);
      updateMark(guardian, this.enemyList, hooks);
      guardian.tick(this.nowMs, this.targetPool, (attacker, target) => this.resolveAttack(attacker, target));
    }
    for (const guardian of this.guardianList) {
      updatePushWave(guardian, this.enemyList, hooks);
      updateSonar(guardian, this.enemyList, this.guardianList, hooks);
    }
    const damage = (enemy: MatchEnemy, amount: number, options?: DamageOptions) => this.damage(enemy, amount, options);
    // Área, splash e corrente alcançam os pontos fracos de graça, por usarem o mesmo conjunto.
    this.areas.update({ now: this.nowMs, enemies: this.targetPool, damage, emit: this.emitBound });
    this.projectileSystem.update(deltaMs, { now: this.nowMs, enemies: this.targetPool, currents: this.currents, damage, emit: this.emitBound });

    for (let index = this.enemyList.length - 1; index >= 0; index -= 1) {
      if (this.enemyList[index].dead || this.enemyList[index].reachedGoal) this.enemyList.splice(index, 1);
    }
    for (let index = this.weakPointList.length - 1; index >= 0; index -= 1) {
      if (this.weakPointList[index].dead) this.weakPointList.splice(index, 1);
    }
  }

  // ----------------------------------------------------------------- internos

  private readonly emitBound = (event: MatchEvent): void => this.emit(event);

  private emit(event: MatchEvent): void {
    this.listener?.(event);
  }

  private spawnEnemy(
    enemyId: EnemyId,
    at: { pathId: string; pathDistance: number } = { pathId: MAIN_PATH_ID, pathDistance: 0 },
    eliteId: EliteId | null = null,
  ): void {
    const base = eliteId ? applyElite(ENEMIES[enemyId], ELITES[eliteId]) : ENEMIES[enemyId];
    const definition = scaleEnemy(base, this.level.enemyScaling, this.level.enemyOverrides?.[enemyId]);
    const route = this.routes.get(at.pathId) ?? this.route;
    const enemy = new MatchEnemy(`E${++this.enemySerial}`, definition, route, at.pathId);
    if (at.pathDistance > 0) enemy.setPathDistance(at.pathDistance);
    this.enemyList.push(enemy);
    this.abilitySystem.register(enemy, this.abilityWorld());
    this.emit({ type: "enemySpawned", now: this.nowMs, id: enemy.id, enemyId, x: enemy.x, y: enemy.y, pathId: at.pathId });
    this.onBossEvents(this.bossEncounter.onSpawn(enemy), enemy);
    this.spawnWeakPoints(enemy);
  }

  /** Traduz os eventos do encontro de chefe para eventos de partida (e paga a recompensa extra). */
  private onBossEvents(events: readonly BossEncounterEvent[], enemy: MatchEnemy): void {
    for (const event of events) {
      switch (event.type) {
        case "bossStarted":
          this.emit({
            type: "bossStarted",
            now: this.nowMs,
            id: enemy.id,
            enemyId: enemy.definition.baseId ?? enemy.definition.id,
            name: event.name,
            title: event.title,
            phaseCount: event.phaseCount,
          });
          break;
        case "bossPhaseChanged":
          this.emit({
            type: "bossPhaseChanged",
            now: this.nowMs,
            id: enemy.id,
            phaseIndex: event.phaseIndex,
            phaseCount: this.bossEncounter.snapshot()?.phaseCount ?? event.phaseIndex + 1,
            announcement: event.phase.announcement ?? null,
          });
          break;
        case "bossDefeated":
          if (event.extraPearls > 0) this.earn(event.extraPearls, "SpecialReward", DEFAULT_PLAYER_ID);
          this.emit({
            type: "bossDefeated",
            now: this.nowMs,
            id: enemy.id,
            enemyId: enemy.definition.baseId ?? enemy.definition.id,
            name: enemy.definition.name,
            x: enemy.x,
            y: enemy.y,
          });
          break;
        case "bossLeaked":
          break;
      }
    }
  }

  /** Contexto que as habilidades de inimigo enxergam (item 6): sem Phaser, sem acesso à cena. */
  private abilityWorld(): EnemyAbilityWorld<MatchEnemy> {
    return {
      now: this.nowMs,
      enemies: this.enemyList,
      guardians: this.guardianList,
      currents: this.currents,
      spawnEnemy: (enemyId, at) => this.spawnEnemy(enemyId, at),
      heal: (enemy, amount) => enemy.heal(amount),
      emit: (event) => this.onAbilityEvent(event),
    };
  }

  private onAbilityEvent(event: EnemyAbilityEvent): void {
    if (event.type !== "currentsAmplified") return;
    const boss = this.enemy(event.enemyId);
    this.emit({ type: "currentsAmplified", now: this.nowMs, amplified: event.amplified, bossName: boss?.definition.name ?? null });
  }

  private leak(enemy: MatchEnemy): void {
    this.removeWeakPointsOf(enemy.id);
    this.bossEncounter.onRemoved(enemy);
    const damage = this.invincible ? 0 : Math.round(enemy.definition.reefDamage * enemy.mods.reefDamage);
    this.reefValue = Math.max(0, this.reefValue - damage);
    this.stats.recordLeak(enemy.definition.id, damage, controlTier(enemy.definition));
    this.emit({
      type: "enemyReachedGoal",
      now: this.nowMs,
      id: enemy.id,
      enemyId: enemy.definition.id,
      name: enemy.definition.name,
      reefDamage: damage,
      reefLeft: this.reefValue,
    });
    if (this.reefValue <= 0 && this.statusValue === "running") {
      this.statusValue = "defeat";
      this.emit({ type: "defeat", now: this.nowMs });
    }
  }

  private behaviorHooks(): BehaviorHooks<MatchEnemy> {
    return {
      now: this.nowMs,
      damage: (enemy, amount, options) => this.damage(enemy, amount, { cause: "trap", ...options }),
      earn: (amount) => this.earn(amount, "GuardianGeneration", DEFAULT_PLAYER_ID),
      spawnCloud: (ownerId, x, y, cloud) => this.areas.createToxicCloud(ownerId, x, y, cloud, this.nowMs, this.emitBound),
      onEscaped: (blockerId, enemyId) => {
        const blocker = this.guardian(blockerId);
        const cooldown = blocker?.stats.blockHold?.releaseCooldownMs ?? 500;
        this.blocking.notifyEscaped(blockerId, enemyId, this.nowMs, cooldown);
      },
      emit: (event) => this.emit({ type: "behavior", now: this.nowMs, event }),
    };
  }

  private drainPoison(): void {
    for (const enemy of this.enemyList) {
      if (enemy.dead || enemy.reachedGoal) continue;
      const owed = enemy.status.drainPoison(this.nowMs);
      if (owed > 0) this.damage(enemy, owed, { continuous: true, cause: "poison" });
    }
  }

  private resolveAttack(guardian: MatchGuardian, target: MatchEnemy): void {
    resolveAttack(
      {
        now: this.nowMs,
        enemies: this.enemyList,
        damage: (enemy, amount, options) => this.damage(enemy, amount, options),
        fireProjectile: (owner, enemy) => this.projectileSystem.fire(owner, enemy, this.nowMs, this.emitBound),
        createField: (owner, x, y) => {
          if (this.areas.createField(owner, x, y, this.nowMs, this.emitBound)) this.stats.abilitiesUsed += 1;
        },
        createCloud: (owner, x, y) => {
          if (this.areas.createInkCloud(owner, x, y, this.nowMs, this.emitBound)) this.stats.abilitiesUsed += 1;
        },
        emit: this.emitBound,
      },
      guardian,
      target,
    );
  }

  /** Cria os pontos fracos declarados pelo chefe, se houver. */
  private spawnWeakPoints(parent: MatchEnemy): void {
    const plan = parent.definition.weakPoints;
    if (!plan || plan.count <= 0) return;
    const definition = weakPointDefinition(plan, parent.definition);
    for (let index = 0; index < plan.count; index += 1) {
      const anchor = plan.anchors[index % plan.anchors.length];
      const weakPoint = new MatchWeakPoint(`W${++this.weakPointSerial}`, definition, parent, anchor, index);
      this.weakPointList.push(weakPoint);
      this.emit({
        type: "weakPointSpawned",
        now: this.nowMs,
        id: weakPoint.id,
        parentId: parent.id,
        index,
        name: plan.name,
        x: weakPoint.x,
        y: weakPoint.y,
        maxHealth: weakPoint.definition.maxHealth,
      });
    }
  }

  /**
   * Dano num ponto fraco. Deliberadamente NÃO passa por nada que pague o jogador: sem pérola de
   * abate, sem `enemyKilled`, sem entrada no bestiário. O que ele dá é o estrago no chefe.
   */
  private damageWeakPoint(weakPoint: MatchWeakPoint, amount: number, options: DamageOptions): void {
    const outcome = options.continuous ? weakPoint.takeContinuousDamage(amount, options) : weakPoint.takeDamage(amount, options);
    if (outcome.applied <= 0 && !outcome.killed) return;
    const source = options.sourceId ? this.guardian(options.sourceId) : undefined;
    const cause = options.cause ?? "melee";
    this.stats.recordDamage(outcome.applied, cause, options.sourceId ?? null, source?.guardianId ?? null);
    this.emit({
      type: "weakPointDamaged",
      now: this.nowMs,
      id: weakPoint.id,
      parentId: weakPoint.parent.id,
      index: weakPoint.index,
      amount: outcome.applied,
      health: weakPoint.health,
      maxHealth: weakPoint.definition.maxHealth,
      x: weakPoint.x,
      y: weakPoint.y,
      sourceId: options.sourceId ?? null,
    });
    if (!outcome.killed) return;

    const plan = weakPoint.parent.definition.weakPoints;
    const burst = plan ? weakPointBurstDamage(plan, weakPoint.parent.definition) : 0;
    this.emit({
      type: "weakPointDestroyed",
      now: this.nowMs,
      id: weakPoint.id,
      parentId: weakPoint.parent.id,
      index: weakPoint.index,
      x: weakPoint.x,
      y: weakPoint.y,
      burstDamage: burst,
      reason: "broken",
    });
    // Reentrância de um nível só, por construção: o pai é um inimigo comum e nunca é ponto fraco.
    const parent = weakPoint.parent;
    if (burst > 0 && !parent.dead && !parent.reachedGoal) {
      // `continuous` porque é ruptura interna: ignora a armadura, mas passa pelo funil normal de
      // dano, então as fases do chefe e o `bossDefeated` continuam avaliados como sempre.
      this.damage(parent, burst, { continuous: true, cause: "weakPoint", sourceId: options.sourceId });
    }
  }

  /** O chefe saiu de campo: os pontos presos a ele vão junto, sem recompensa nem estardalhaço. */
  private removeWeakPointsOf(parentId: string): void {
    for (let index = this.weakPointList.length - 1; index >= 0; index -= 1) {
      const weakPoint = this.weakPointList[index];
      if (weakPoint.parent.id !== parentId) continue;
      this.weakPointList.splice(index, 1);
      this.emit({
        type: "weakPointDestroyed",
        now: this.nowMs,
        id: weakPoint.id,
        parentId,
        index: weakPoint.index,
        x: weakPoint.x,
        y: weakPoint.y,
        burstDamage: 0,
        reason: "parentGone",
      });
    }
  }

  private damage(enemy: MatchEnemy, amount: number, options: DamageOptions = {}): void {
    if (enemy.isWeakPoint) {
      this.damageWeakPoint(enemy as MatchWeakPoint, amount, options);
      return;
    }
    const outcome = options.continuous ? enemy.takeContinuousDamage(amount, options) : enemy.takeDamage(amount, options);
    if (outcome.applied <= 0 && !outcome.killed) return;
    const cause = options.cause ?? (options.continuous ? "contact" : "melee");
    const source = options.sourceId ? this.guardian(options.sourceId) : undefined;
    this.abilitySystem.damaged(enemy, outcome.applied, this.abilityWorld());
    this.onBossEvents(this.bossEncounter.onDamaged(enemy, this.abilityWorld()), enemy);
    this.stats.recordDamage(outcome.applied, cause, options.sourceId ?? null, source?.guardianId ?? null);
    if (this.listener) {
      this.emit({
        type: "enemyDamaged",
        now: this.nowMs,
        id: enemy.id,
        amount: outcome.applied,
        health: enemy.health,
        maxHealth: enemy.definition.maxHealth,
        x: enemy.x,
        y: enemy.y,
        cause,
        sourceId: options.sourceId ?? null,
      });
    }
    if (!outcome.killed) return;
    this.removeWeakPointsOf(enemy.id);
    this.abilitySystem.died(enemy, this.abilityWorld());
    this.onBossEvents(this.bossEncounter.onRemoved(enemy), enemy);
    const reward = this.earn(enemy.definition.reward, "EnemyReward", DEFAULT_PLAYER_ID);
    this.stats.recordKill(enemy.definition.id, Boolean(enemy.definition.isBoss), source?.guardianId ?? null);
    if (!this.interactables.isEmpty) this.interactables.onEnemyKilled(enemy.definition.id).forEach((runtime) => this.resolveInteractable(runtime));
    this.emit({
      type: "enemyKilled",
      now: this.nowMs,
      id: enemy.id,
      enemyId: enemy.definition.id,
      x: enemy.x,
      y: enemy.y,
      reward,
      killerId: options.sourceId ?? null,
    });
  }

  private updateAuras(): void {
    const sources: AuraSource[] = [];
    for (const guardian of this.guardianList) {
      const provided = guardian.stats.providedAura;
      if (provided) sources.push({ id: guardian.id, x: guardian.x, y: guardian.y, range: guardian.range, aura: provided });
      const chorus = updateChorus(guardian, this.guardianList, this.nowMs, (event) => this.emit({ type: "behavior", now: this.nowMs, event }));
      if (chorus) sources.push(chorus);
    }
    this.guardianList.forEach((guardian) =>
      guardian.setAura(resolveAura({ id: guardian.id, guardianId: guardian.guardianId, x: guardian.x, y: guardian.y }, sources)),
    );
  }

  /** Zonas de corrente presas a Guardiões (Tartaruga): recalculadas a cada tick a partir dos stats. */
  private syncGuardianCurrents(): void {
    const owners = new Set<string>();
    for (const field of flowFieldsFor(this.guardianList)) {
      owners.add(field.ownerId);
      this.currents.setOwnerZones(field.ownerId, [zoneFromFlowField(field)]);
    }
    for (const guardian of this.guardianList) if (!owners.has(guardian.id)) this.currents.setOwnerZones(guardian.id, []);
  }

  /**
   * Crédito de pérolas. No modo individual, o que a partida gera (recompensa de inimigo, de onda) vai
   * para todo mundo; no compartilhado, para o caixa único.
   */
  private earn(amount: number, source: PearlSource, playerId: PlayerId): number {
    if (this.economyMode === "individual" && SHARED_SOURCES.includes(source)) {
      let credited = 0;
      for (const player of this.players) {
        const value = this.walletOf(player.id).earn(amount, source);
        if (value > 0) this.emit({ type: "pearlsChanged", now: this.nowMs, playerId: player.id, pearls: this.pearls(player.id), delta: value, source });
        if (player.id === playerId) credited = value;
      }
      return credited || amount;
    }
    const wallet = this.walletOf(playerId);
    const credited = wallet.earn(amount, source);
    if (credited > 0) this.emit({ type: "pearlsChanged", now: this.nowMs, playerId, pearls: wallet.pearls, delta: credited, source });
    return credited;
  }

  private spend(cost: number, sink: PearlSink, playerId: PlayerId): void {
    const wallet = this.walletOf(playerId);
    wallet.spend(cost, sink);
    this.emit({ type: "pearlsChanged", now: this.nowMs, playerId, pearls: wallet.pearls, delta: -cost, source: sink });
  }
}
